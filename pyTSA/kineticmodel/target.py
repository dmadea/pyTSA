from __future__ import annotations

import re
import numpy as np
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..dataset import Dataset

from .firstorder import FirstOrderModel
from ..mathfuncs import simulate_target_model

from lmfit import Parameters


class TargetFirstOrderModel(FirstOrderModel):

    name = "General abstract class for creating target models"

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1, set_model: bool = False):
        super(TargetFirstOrderModel, self).__init__(dataset, n_species, set_model)
        self._calculate_EAS = False
        self._include_rates_params = False
        # self.C_opt_full = None

        # list of compartments that will be assigned from simulated target model (C_opt_full)
        # to C_opt
        self.used_compartments = [0]

    def target_params(self, params: Parameters) -> tuple[np.ndarray, np.ndarray]:
        """Return a tuple with the first argument as initial j vector and second argument is K matrix"""
        raise NotImplementedError()
    
    def get_labels(self, t_unit='ps'):
        raise NotImplementedError()

    def get_b_array(self, params: Parameters | None = None) -> np.ndarray:
        return np.zeros(self.n_species)

    def calculate_C_profiles(self, params: Parameters | None = None, times: np.ndarray | None = None):
        params = self.params if params is None else params
        t = self.dataset.times if times is None else times

        if self.n_species == 0:
            return
        
        j, K = self.target_params(params)
        b = None #self.get_b_array()

        f = self.get_exp_function()

        # Apply multi-IRF mixture: each C profile is a weighted sum over per-IRF simulations.
        C_sum = None
        for amp, width_irf, mu_irf in self._iter_irf_components(params, skip_zero_amp=False):
            C_irf = simulate_target_model(f, K, j, t, width_irf, b, mu_irf)
            C_sum = amp * C_irf if C_sum is None else (C_sum + amp * C_irf)

        self.C_opt_full = C_sum

        if len(self.used_compartments) == 0:
            raise ValueError("At least one compartment has to be assigned to C_opt")
        else:
            self.C_opt = self.C_opt_full[..., self.used_compartments]



class TextBasedTargetFirstOrderModel(TargetFirstOrderModel):

    name = "Text-based parametric target first-order kinetic model"

    def __init__(self, dataset: Dataset | None = None, text: str | None = None, set_model: bool = False):
        self.text = text or ""
        self.n_species = 1
        self.parse_text(self.text)

        self._include_rates_params = False
        super(TextBasedTargetFirstOrderModel, self).__init__(dataset, self.n_species, set_model)
        if self.n_species > 0:
            self.used_compartments = list(range(self.n_species))


    def parse_text(self, text: str):
        """
        Parse text-based first-order kinetic scheme.

        -> denotes the forward first order reaction.

        Rate constants for individual reactions can be taken from the text input. They are denoted
        at the end of the each line after '//' characters and are separated by semicolon ';'. If the rate
        constant name is not specified, default name using the reactants and products will be used.
        Comments are denoted by '#'. All characters after this symbol will be ignored.

        Example
        ----------
        First example: j vector is parameterized by j_S_1 and this parameter will be added to the parameters list.
        In default, this parameter will be fixed and value will be 1.
            S_1 -> T_1 -> // k_S; k_T   # singlet state decay and triplet state decay
            S_1_imp -> // k_imp  # impurity decay

            j = [j_S_1, 0, 1 - j_S_1]

        Second example: Branched kinetics, instead of fitting individual rates k_ST and k_SP,
        we will introduce another parameters: rate k_tot_1 = k_ST + k_SP and the branching ratio alpha_S_1_T_1.
            S_1 -> T_1 -> // k_ST; k_T   # singlet state decay and triplet state decay
            S_1 -> P // k_SP  # formation of the product from the singlet state

            j = [1, 0, 0]

        For branched kinetics, k_tot_[index] and alpha_[reactant]_[product] are used.
        If j vector is not specified, it will be assumed as [1, 0, ..., 0].
        """
        if not text or not text.strip():
            self._transitions = []
            self._species = []
            self._j_spec = []
            self._branched_reactants = {}
            self._simple_transitions = []
            self.n_species = 0
            self.used_compartments = [0]
            return

        # Match + signs for separating multiple species (first-order typically has one per side)
        p_plus = re.compile(r'(?<![^_\}])\+')

        transitions: list[tuple[str, str | None, str]] = []
        species_set: dict[str, int] = {}  # name -> order of first appearance
        j_spec: list[str | float] = []
        seen_species_order = 0

        def add_species(name: str) -> None:
            nonlocal seen_species_order
            name = name.strip()
            if name and name not in species_set:
                species_set[name] = seen_species_order
                seen_species_order += 1

        def parse_species_side(side: str) -> list[str]:
            """Parse 'S_1 + T_1' into ['S_1', 'T_1']. First-order: expect single species per arrow."""
            parts = re.split(p_plus, side)
            return [p.strip().replace(" ", "") for p in parts if p.strip()]

        for raw_line in filter(None, text.split('\n')):
            line = raw_line.strip().split('#')[0].strip()
            if not line:
                continue

            # Check for j = [...] specification
            j_match = re.match(r'j\s*=\s*\[(.*)\]', line, re.IGNORECASE)
            if j_match:
                inner = j_match.group(1)
                for item in re.split(r'[,;]', inner):
                    item = item.strip()
                    try:
                        j_spec.append(float(item))
                    except ValueError:
                        j_spec.append(item)
                continue

            # Split reaction part from rate names
            parts = list(filter(None, line.split('//')))
            reaction_part = parts[0].strip()
            rate_names = []
            if len(parts) > 1:
                rate_names = [r.strip() for r in parts[1].split(';') if r.strip()]

            # Split by -> to get chain: A -> B -> C -> (empty = decay to sink)
            sides = re.split(r'\s*->\s*', reaction_part)
            sides = [s.strip() for s in sides]

            rate_idx = 0
            for i in range(len(sides) - 1):
                from_parts = parse_species_side(sides[i])
                to_parts = parse_species_side(sides[i + 1]) if sides[i + 1] else []

                if len(from_parts) != 1:
                    raise ValueError(f"First-order reactions require single reactant, got: {sides[i]}")
                from_sp = from_parts[0]
                to_sp = to_parts[0] if to_parts else None  # decay to sink

                add_species(from_sp)
                if to_sp:
                    add_species(to_sp)

                rate_name = rate_names[rate_idx] if rate_idx < len(rate_names) else f"k_{from_sp}_{to_sp or '0'}"
                transitions.append((from_sp, to_sp, rate_name))
                rate_idx += 1

        # Build ordered species list (first species = typically initial excited state)
        species = sorted(species_set.keys(), key=lambda s: species_set[s])
        self._species = species
        self.n_species = len(species)
        self._transitions = transitions
        self._j_spec = j_spec

        # Identify branched kinetics: same reactant with multiple outgoing reactions
        from_collect: dict[str, list[tuple[str | None, str]]] = {}
        for fr, to, rn in transitions:
            from_collect.setdefault(fr, []).append((to, rn))

        self._branched_reactants = {k: v for k, v in from_collect.items() if len(v) > 1}
        self._simple_transitions = [(fr, to, rn) for fr, to, rn in transitions
                                    if fr not in self._branched_reactants]

    def init_params(self) -> Parameters:
        params = super(TextBasedTargetFirstOrderModel, self).init_params()

        sp_idx = {s: i for i, s in enumerate(self._species)}

        # Add k_tot and alpha for branched reactants
        for idx, (reactant, branches) in enumerate(self._branched_reactants.items()):
            params.add(f'k_tot_{idx}', value=1.0, min=0, max=np.inf, vary=True)
            for to_sp, rate_name in branches[:-1]:  # n-1 alphas for n branches
                prod_name = to_sp or "0"
                alpha_name = f"alpha_{reactant}_{prod_name}"
                params.add(alpha_name, value=0.5, min=0, max=1, vary=False)

        # Add simple (non-branched) rate parameters
        for fr, to, rate_name in self._simple_transitions:
            if rate_name not in params:
                params.add(rate_name, value=1.0, min=0, max=np.inf, vary=True)

        # Add j vector parameters
        for item in self._j_spec:
            if isinstance(item, str) and item not in params:
                # Support "1 - param" format
                m = re.match(r'1\s*-\s*(\w+)', item)
                if m:
                    ref = m.group(1)
                    if ref not in params:
                        params.add(ref, value=1.0, min=0, max=1, vary=False)
                elif not re.match(r'^[\d.]+$', item):
                    params.add(item, value=1.0, min=0, max=1, vary=False)

        return params

    def target_params(self, params: Parameters) -> tuple[np.ndarray, np.ndarray]:
        """Return a tuple with the first argument as initial j vector and second argument is K matrix."""
        n = self.n_species
        sp_idx = {s: i for i, s in enumerate(self._species)}
        K = np.zeros((n, n))

        def get_rate(reactant: str, to: str | None, rate_name: str) -> float:
            if reactant in self._branched_reactants:
                branches = self._branched_reactants[reactant]
                tot_key = f"k_tot_{list(self._branched_reactants.keys()).index(reactant)}"
                k_tot = params[tot_key].value
                for i, (to_sp, rn) in enumerate(branches):
                    if (to_sp, rn) == (to, rate_name):
                        if i < len(branches) - 1:
                            alpha_name = f"alpha_{reactant}_{to_sp or '0'}"
                            alpha = params[alpha_name].value
                            return alpha * k_tot
                        else:
                            alphas = [params[f"alpha_{reactant}_{t or '0'}"].value
                                       for t, _ in branches[:-1]]
                            return (1 - sum(alphas)) * k_tot
            return params[rate_name].value

        for fr, to, rate_name in self._transitions:
            i = sp_idx[fr]
            k = get_rate(fr, to, rate_name)
            K[i, i] -= k
            if to is not None and to in sp_idx:
                j = sp_idx[to]
                K[j, i] += k

        # j vector
        if self._j_spec:
            j_arr = np.zeros(n)
            for idx, item in enumerate(self._j_spec):
                if idx >= n:
                    break
                if isinstance(item, (int, float)):
                    j_arr[idx] = float(item)
                else:
                    m = re.match(r'1\s*-\s*(\w+)', item)
                    if m:
                        j_arr[idx] = 1.0 - params[m.group(1)].value
                    else:
                        j_arr[idx] = params[item].value
            # Normalize
            s = j_arr.sum()
            if s > 0:
                j_arr /= s
        else:
            j_arr = np.zeros(n)
            j_arr[0] = 1.0

        return j_arr, K

    def get_labels(self, t_unit: str = 'ps') -> list[str]:
        """Return LaTeX-style labels for each species."""
        labels = []
        for s in self._species:
            # Convert S_1 to $S_1$, handle subscripts
            s_clean = s.replace(" ", "")
            labels.append(f'${s_clean}$')
        return labels


class SensitizationModel(TargetFirstOrderModel):

    name = "Sensitizatization kinetic model"

    def init_params(self) -> Parameters:
        params = super(SensitizationModel, self).init_params()

        params.add('k_sens_0', value=2, min=0, max=np.inf, vary=True)
        params.add('Kq', value=1, min=0, max=np.inf, vary=True)
        params.add('k_T', value=0.5, min=0, max=np.inf, vary=True)

        return params
    
    def get_labels(self, t_unit='ps'):
        raise NotImplementedError()
    
    def target_params(self, params: Parameters) -> tuple[np.ndarray, np.ndarray]:
        """Return a tuple with the first argument as initial j vector and second argument is K matrix"""
        
        k_sens_0, Kq, k_T = params['k_sens_0'].value, params['Kq'].value, params['k_T'].value

        K = np.asarray([[-k_sens_0 - Kq, 0],
                        [Kq,      -k_T]])
    
        j = np.asarray([1, 0])

        return j, K


class SingletFissionModel(TargetFirstOrderModel):

    name = "Singlet fission kinetic model"

    def __init__(self, dataset: Dataset | None = None, set_model: bool = False):
        super(SingletFissionModel, self).__init__(dataset, 4, set_model)
        self.used_compartments = [0, 1, 2, 3]

    def init_params(self) -> Parameters:
        params = super(SingletFissionModel, self).init_params()

        params.add('tau_S1_hot', value=0.5, min=0, max=np.inf, vary=True)
        params.add('tau_TT', value=200, min=0, max=np.inf, vary=True)
        params.add('tau_S1', value=2500, min=0, max=np.inf, vary=True)
        params.add('alpha_S1_hot_TT', value=0.5, min=0, max=1, vary=False)

        return params
    
    def get_labels(self, t_unit='ps'):
        return ['$S_1^{hot}$', '$S_1$', '$^1(T_1T_1)$', '$T_1+T_1$']
    
    def target_params(self, params: Parameters) -> tuple[np.ndarray, np.ndarray]:
        """Return a tuple with the first argument as initial j vector and second argument is K matrix"""

        tau_S1_hot, tau_TT, tau_S1, alpha_S1_hot_TT = params['tau_S1_hot'].value, params['tau_TT'].value, params['tau_S1'].value, params['alpha_S1_hot_TT'].value

        K = np.asarray([[-1/tau_S1_hot, 0, 0, 0],
                        [(1 - alpha_S1_hot_TT) / tau_S1_hot, -1/tau_S1, 0, 0],
                        [alpha_S1_hot_TT / tau_S1_hot, 0, -1/tau_TT, 0],       
                        [0, 1/tau_S1, 1/tau_TT, 0]])
    
        j = np.asarray([1, 0, 0, 0])

        return j, K


class SingletFissionModelImpurity(TargetFirstOrderModel):

    name = "Singlet fission kinetic model"

    def __init__(self, dataset: Dataset | None = None, set_model: bool = False):
        super(SingletFissionModelImpurity, self).__init__(dataset, 4, set_model)
        self.used_compartments = [0, 1, 2, 3]

    def init_params(self) -> Parameters:
        params = super(SingletFissionModelImpurity, self).init_params()

        params.add('tau_S1_hot', value=0.5, min=0, max=np.inf, vary=True)
        params.add('tau_TT', value=200, min=0, max=np.inf, vary=True)
        params.add('tau_imp', value=12300, min=0, max=np.inf, vary=False)
        params.add('alpha_imp', value=0.1, min=0, max=1, vary=False)

        return params
    
    def get_labels(self, t_unit='ps'):
        return ['$S_1^{hot}$', '$S_1^{imp}$', '$^1(T_1T_1)$', '$T_1+T_1$']
    
    def target_params(self, params: Parameters) -> tuple[np.ndarray, np.ndarray]:
        """Return a tuple with the first argument as initial j vector and second argument is K matrix"""

        tau_S1_hot, tau_TT, tau_imp, alpha_imp = params['tau_S1_hot'].value, params['tau_TT'].value, params['tau_imp'].value, params['alpha_imp'].value

        # S1 hot, impurity, TT, T1 + T1

        K = np.asarray([[-1/tau_S1_hot, 0, 0, 0],
                        [0, -1/tau_imp, 0, 0],
                        [1 / tau_S1_hot, 0, -1/tau_TT, 0],       
                        [0, 0, 1/tau_TT, 0]])
    
        j = np.asarray([(1 - alpha_imp), alpha_imp, 0, 0])

        return j, K
        

class DelayedFluorescenceModel(TargetFirstOrderModel):

    name = "Delayed fluorescence kinetic model"

    def __init__(self, dataset: Dataset | None = None, set_model: bool = False):
        self.add_quenching_rates = False
        self.add_extra_first_order_compartment = False
        self.add_inf_compartment = False
        super(DelayedFluorescenceModel, self).__init__(dataset, 3, set_model)

        self.used_compartments = [0]


    def init_params(self) -> Parameters:
        params = super(DelayedFluorescenceModel, self).init_params()

        if self.add_extra_first_order_compartment:
            params.add('k_1', value=1, min=0, max=np.inf, vary=True)

        params.add('k_rnr', value=0.05, min=0, max=np.inf, vary=True)
        params.add('k_isc', value=0.1, min=0, max=np.inf, vary=True)
        params.add('k_risc', value=0.05, min=0, max=np.inf, vary=True)

        if self.add_quenching_rates:
            params.add('Kq_singlet', value=0.0, min=0, max=np.inf, vary=True)
            params.add('Kq_triplet', value=0.0, min=0, max=np.inf, vary=True)
            # params.add('f_spin', value=0, min=0, max=np.inf, vary=True)

            params.add('K_iisc', value=0.0, min=0, max=np.inf, vary=True)
            params.add('K_irisc', value=0.0, min=0, max=np.inf, vary=True)


        return params
    
    def get_labels(self, t_unit='ps'):
        if self.add_extra_first_order_compartment:
            labels = np.asarray(['LE', 'CT_S1', 'CT_T1'])
        elif self.add_inf_compartment:
            labels = np.asarray(['S$_1$', 'T$_1$', 'inf'])
        else:
            labels = np.asarray(['S1', 'T1'])

        # return list(labels[self.used_compartments])
        return labels
    
    
    def target_params(self, params: Parameters | None = None) -> tuple[np.ndarray, np.ndarray]:
        """Return a tuple with the first argument as initial j vector and second argument is K matrix"""
        
        k_rnr, k_isc, k_risc = params['k_rnr'].value, params['k_isc'].value, params['k_risc'].value

        kq_s = 0
        kq_t = 0
        ki_isc = 0
        ki_risc = 0

        if self.add_quenching_rates:
            kq_s = params['Kq_singlet'].value
            kq_t = params['Kq_triplet'].value
            ki_isc = params['K_iisc'].value
            ki_risc = params['K_irisc'].value
            # f_spin = params['f_spin'].value
            # ki_isc = k_isc * f_spin
            # ki_risc = k_risc * f_spin
        
        # K = np.asarray([[-k_rnr - k_isc - kq_s, k_risc],
        #                 [k_isc,         -k_risc - kq_t]])
        
        # K = np.asarray([[-k_rnr - k_isc - kq_isc - kq_s, k_risc + kq_risc],
        #         [k_isc + kq_isc,         -k_risc - kq_risc - kq_t]])

        if self.add_inf_compartment:
        
            K = np.asarray([[-k_rnr - k_isc - ki_isc - kq_s, k_risc + ki_risc, 0],
                        [k_isc + ki_isc,         -k_risc - ki_risc - kq_t, 0],
                        [k_rnr, 0, 0]])
        
            j = np.asarray([1, 0, 0])

        else:
                    
            K = np.asarray([[-k_rnr - k_isc - ki_isc - kq_s, k_risc + ki_risc],
                             [k_isc + ki_isc,         -k_risc - ki_risc - kq_t]])
        
            j = np.asarray([1, 0])

        if self.add_extra_first_order_compartment:
            k_1 = params['k_1'].value
            K = np.asarray([[-k_1,      0,              0],
                            [k_1, -k_rnr - k_isc - ki_isc - kq_s,  k_risc + ki_risc],
                            [0,      k_isc + ki_isc,       -k_risc - ki_risc - kq_t]])

            j = np.asarray([1, 0, 0])


        return j, K
        