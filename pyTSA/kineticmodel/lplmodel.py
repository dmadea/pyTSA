from __future__ import annotations
import os
from typing import Callable, Literal

import numpy as np
from lmfit import Parameters, Minimizer, conf_interval, conf_interval2d, report_ci
from lmfit.minimizer import MinimizerResult

from abc import abstractmethod
from enum import Enum, auto

from scipy.integrate import solve_ivp


from ..dataset import Dataset


import matplotlib.pyplot as plt
import matplotlib.colors as mplcols
import matplotlib.gridspec as gridspec
from matplotlib.colors import LogNorm, Normalize

# import glob, os
import scipy.constants as sc
from copy import deepcopy
from dataclasses import dataclass, fields

from .kineticmodel import KineticModel

from scipy.constants import Boltzmann

KB_EV = Boltzmann / sc.e

# TODO log parametrization of rates


def save_matrix(dim0: np.iterable, dim1: np.iterable, matrix: np.ndarray, fname='output.txt', delimiter='\t', encoding='utf8', transpose=False):
    mat = np.vstack((dim0, matrix.T)) if transpose else np.vstack((dim1, matrix))
    buffer = delimiter + delimiter.join(f"{num}" for num in (dim1 if transpose else dim0)) + '\n'
    buffer += '\n'.join(delimiter.join(f"{num}" for num in row) for row in mat.T)

    with open(fname, 'w', encoding=encoding) as f:
        f.write(buffer)



class LPLModel(KineticModel):
    """

    Attributes
    ----------

    Methods
    -------

    """

    name = "LPL model"


    def __init__(self, dataset: Dataset | None = None, n_species: int = 1, set_model: bool = False):

        self.exposure_time_s: float = 1
        self.lambda_irr_nm = 365
        self.P_irr_mW = 2
        self.I0 = self.P_irr_mW * 1e-3 * self.lambda_irr_nm * 1e-9 / (sc.h * sc.c) # light intensity in photons / s
        self.data_type: Literal['LPL', 'PMA'] = 'LPL'
        self.temp_dep_rates: list[str] = []
        self.n_E: int = 300  # number of points to simulate the gaussian distribution of trap depths
        self.E_max = 2  #  maximum trap depth in eV
        self.n_gaussians: int = 1
        self.add_exp_distribution: bool = False

        self.Es: np.ndarray = None
        self.t_acum: np.ndarray = None
        self.accum_phase_solution: None | np.ndarray = None
        self.lpl_phase_solution: None | np.ndarray = None

        self.pair_conc: None | np.ndarray = None

        self.ridge_alpha = 0.0001

        self.initial_state: None | Callable = None
        self.temp_fun: Callable | None = None  # takes time as argument

        super(LPLModel, self).__init__(dataset, n_species, set_model)


    def init_params(self) -> Parameters:
        params = super(LPLModel, self).init_params()

        for i in range(self.n_gaussians):
            params.add(f'rho_amp_{i}', value=1, min=0, max=np.inf, vary=True)
            params.add(f'rho_mu_{i}', value=1, min=0, max=self.E_max, vary=True)
            params.add(f'rho_sigma_{i}', value=0.2, min=0, max=self.E_max, vary=True)

        if self.add_exp_distribution:
            params.add('rho_exp_amp', value=1, min=0, max=np.inf, vary=True)
            params.add('rho_exp_lambda', value=10, min=0, max=np.inf, vary=True)

        params.add('s0', value=1e13, min=0, max=np.inf, vary=False) 

        return params

    @staticmethod
    def arrhenius(E: np.ndarray, T: np.ndarray) -> np.ndarray:
        """Boltzmann factor exp(-E / kB*T); E in eV, T in K."""
        return np.exp(-E / (KB_EV * T))

    @staticmethod
    def gaussian(Es: np.ndarray, mu: float, sigma: float) -> np.ndarray:
        return np.exp(-(Es - mu)**2 / (2 * sigma**2)) / (sigma * np.sqrt(2 * np.pi))

    @staticmethod
    def trapezoid_weights(xs: np.ndarray) -> np.ndarray:
        w = np.full(len(xs), xs[1] - xs[0])
        w[0] /= 2
        w[-1] /= 2
        return w

    def get_rho_0(self, params: Parameters | None = None) -> np.ndarray:
        params = self.params if params is None else params

        Es = np.linspace(0.01, self.E_max, self.n_E)  # energy levels for the gaussian distribution
        self.Es = Es

        rho_0 = np.zeros(self.n_E)
        for i in range(self.n_gaussians):
            rho_0 += params[f'rho_amp_{i}'].value * self.gaussian(Es, params[f'rho_mu_{i}'].value, params[f'rho_sigma_{i}'].value)
        if self.add_exp_distribution:
            rho_0 += params['rho_exp_amp'].value * np.exp(-Es / params['rho_exp_lambda'].value)

        return rho_0

    def build_saturable_rhs_jac(self, params: Parameters, T_fun: Callable, I_fun: Callable):
        raise NotImplementedError("This method is not implemented for the base LPLModel class.")


    def simulate(self, params: Parameters | None = None) -> np.ndarray:
        params = self.params if params is None else params

        if self.initial_state is None:
            u0 = np.zeros(self.n_E + self.n_species)
        else:
            u0 = self.initial_state()

        ivp_kw = dict(method="LSODA", rtol=1e-6, atol=1e-10)  # , first_step=1e-14

        self.I0 = self.P_irr_mW * 1e-3 * self.lambda_irr_nm * 1e-9 / (sc.h * sc.c) # light intensity in photons / s

        # --- accumulation phase: constant illumination I0 at temperature T ---
        rhs_acc, jac_acc = self.build_saturable_rhs_jac(params, T_fun=lambda t: self.temp_fun(t), I_fun=lambda t: self.I0)
        self.t_acum = np.linspace(0, self.exposure_time_s, 100)
        sol_acc = solve_ivp(rhs_acc, (0, self.exposure_time_s), u0, **ivp_kw, jac=jac_acc, t_eval=self.t_acum)
        if not sol_acc.success:
            raise RuntimeError(f"accumulation integration failed: {sol_acc.message}")

        # --- LPL decay phase: light off ---
        rhs_dec, jac_dec = self.build_saturable_rhs_jac(params, T_fun=lambda t: self.temp_fun(t), I_fun=lambda t: 0.0)
        t_lpl = self.dataset.times
        sol_dec = solve_ivp(rhs_dec, (0, t_lpl[-1]), sol_acc.y[:, -1], **ivp_kw, jac=jac_dec, t_eval=t_lpl)
        if not sol_dec.success:
            raise RuntimeError(f"LPL integration failed: {sol_dec.message}")

        self.accum_phase_solution = sol_acc.y
        self.lpl_phase_solution = sol_dec.y

        self.process_solution(params)

    def process_solution(self, params: Parameters | None = None):
        raise NotImplementedError("This method is not implemented for the base LPLModel class.")

    def _require_simulation(self) -> None:
        if self.lpl_phase_solution is None:
            if self.params is None:
                raise RuntimeError("Call simulate() or fit() before plotting.")
            self.simulate()

    def plot(self, *what: str, nrows: int | None = None, ncols: int | None = None, hspace=0.2, wspace=0.2,
             X_SIZE=5.5, Y_SIZE=4.5, add_figure_labels=False, figure_labels_font_size=17, fig_labels_offset=0,
             transparent=True, dpi=300, filepath=None, **kwargs):

        n = len(what)
        if n == 0:
            return

        if self.dataset is None:
            raise TypeError("There is no dataset assigned to the model")

        if nrows is None and ncols is None:
            ncols = int(np.floor(n ** 0.5))
            nrows = int(np.ceil(n / ncols))
        elif nrows is not None and ncols is None:
            ncols = int(np.ceil(n / nrows))
        elif nrows is None and ncols is not None:
            nrows = int(np.ceil(n / ncols))

        fig = plt.figure(figsize=kwargs.get('figsize', (X_SIZE * ncols, Y_SIZE * nrows)))
        outer_grid = gridspec.GridSpec(1, 1, figure=fig)

        self._plot_gs(fig, outer_grid[0], what, nrows, ncols, hspace=hspace, wspace=wspace,
                      add_figure_labels=add_figure_labels, figure_labels_font_size=figure_labels_font_size,
                      fig_labels_offset=fig_labels_offset, **kwargs)

        if filepath:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, bbox_inches='tight', transparent=transparent, dpi=dpi)
        else:
            plt.show()

    def _plot_gs(self, fig: plt.Figure, grid_spec: gridspec.GridSpec | gridspec.GridSpecFromSubplotSpec,
                 what: tuple[str], nrows: int, ncols: int, hspace=0.2, wspace=0.2, add_figure_labels=False,
                 figure_labels_font_size=17, fig_labels_offset=0, **kwargs):

        inner_grid = gridspec.GridSpecFromSubplotSpec(nrows, ncols, wspace=wspace, hspace=hspace, subplot_spec=grid_spec)

        def update_kwargs(prefix: str, kws: dict):
            for key, value in kws.copy().items():
                if key.startswith(prefix.lower()):
                    _key = key[len(prefix) + 1:]
                    kws[_key] = value

        f_labels = list('abcdefghijklmnopqrstuvwxyz')
        f_labels += [s + s for s in f_labels]
        cmap = plt.cm.jet

        for i, (p, ig) in enumerate(zip(what, inner_grid)):
            if i >= nrows * ncols:
                break

            ax = fig.add_subplot(ig)
            kws = kwargs.copy()

            n = self.n_species

            match p.lower():
                case "decay-curve":
                    self._require_simulation()
                    update_kwargs("decay-curve", kws)

                    times = self.dataset.times
                    y_fit = self.matrix_opt[:, 0] if self.matrix_opt.ndim > 1 else self.matrix_opt
                    ax.plot(times, y_fit, label='Fit')

                    if kws.pop('show_data', True):
                        single_dim = self.dataset.matrix_fac.shape[1] == 1
                        y_data = self.dataset.matrix_fac[:, 0] if single_dim else self.dataset.matrix_fac.sum(axis=1)
                        ax.plot(times, y_data, ls='--', label='Data')

                    if kws.pop('show_trap_integral', False):
                        ax_t = ax.twinx()
                        pair = self.pair_conc[:, 0] if self.pair_conc.ndim > 1 else self.pair_conc
                        ax_t.plot(times, pair, ls='--', color='C1')
                        ax_t.set_yscale('log')
                        ax_t.set_ylabel(r'$\int\rho\,dE$ (dashed)')

                    ax.set_xscale('log')
                    ax.set_yscale('log')
                    ax.set_xlabel('Time after irradiation [s]')
                    ax.set_ylabel(r'$n_{CT*}$')
                    ax.set_title(kws.pop('title', 'Recombination (LPL)'))
                    ax.legend(frameon=False)

                case "dist-acum":
                    self._require_simulation()
                    update_kwargs("dist-acum", kws)

                    rho_0 = self.get_rho_0()
                    step = kws.pop('step', 5)
                    idxs = np.arange(0, len(self.t_acum), step)
                    norm = Normalize(self.t_acum[0], self.t_acum[-1])

                    for j in idxs:
                        ax.plot(self.Es, self.accum_phase_solution[n:, j],
                                color=cmap(norm(self.t_acum[j])), lw=1)
                    ax.plot(self.Es, rho_0, color='black', lw=1, ls='--')
                    ax.set_xlabel('E [eV]')
                    ax.set_ylabel(r'$\rho(E)$')
                    ax.set_title(kws.pop('title', r'Charging: $\rho(E,t)$'))
                    fig.colorbar(plt.cm.ScalarMappable(cmap=cmap, norm=norm), ax=ax, label='t [s]')

                case "dist-decay":
                    self._require_simulation()
                    update_kwargs("dist-decay", kws)

                    rho_0 = self.get_rho_0()
                    times = self.dataset.times
                    step = kws.pop('step', 5)
                    idxs = np.arange(0, len(times), step)
                    norm = LogNorm(times[0], times[-1])

                    for j in idxs:
                        ax.plot(self.Es, self.lpl_phase_solution[n:, j],
                                color=cmap(norm(times[j])), lw=1)
                    ax.plot(self.Es, rho_0, color='black', lw=1, ls='--')
                    ax.set_xlabel('E [eV]')
                    ax.set_ylabel(r'$\rho(E)$')
                    ax.set_title(kws.pop('title', r'Recombination: $\rho(E,t)$'))
                    fig.colorbar(plt.cm.ScalarMappable(cmap=cmap, norm=norm), ax=ax, label='t after irr. [s]')

                case _:
                    raise ValueError(f"Plot {p} is not defined.")

            if add_figure_labels:
                ax.text(-0.05, 1.05, f_labels[i + fig_labels_offset], color='black', transform=ax.transAxes,
                        fontstyle='normal', fontweight='bold', fontsize=figure_labels_font_size)


    def residuals(self, params: Parameters):
        self.simulate(params)
        return self.weighted_residuals()

    def fit(self):
        self.minimizer = Minimizer(self.residuals, self.params, nan_policy='omit')
        
        self.fit_result = self.minimizer.minimize(method=self.fit_algorithm, **self.fitter_kwds)  # minimize the residuals
        self.params = self.fit_result.params


class LPLModelCT(LPLModel):
    """

    Attributes
    ----------

    Methods
    -------

    """

    name = "LPL model with single CT state"


    def init_params(self) -> Parameters:
        params = super(LPLModelCT, self).init_params()

        # global amplitude for multi-experiment fit
        params.add('amp_CT', value=1, min=0, max=np.inf, vary=True) 
        params.add('k_sep', value=1e5, min=0, max=1e10, vary=True) 
        params.add('k_CT_rnr', value=1e7, min=0, max=1e10, vary=True)  

        return params


    def build_saturable_rhs_jac(self, params: Parameters, T_fun: Callable, I_fun: Callable):
        """RHS and analytic Jacobian of the arrowhead system with a
        *saturable* trapping term (Pauli blocking).

        T_fun(t), I_fun(t): temperature and generation-rate protocols, which
        lets the same system serve isothermal charging, LPL decay, and TL ramps.
        """

        # simulate the current distribution of trap depths
        rho_0 = self.get_rho_0(params)

        NE = len(self.Es)
        idx = np.arange(1, NE + 1)
        N_tot = np.trapezoid(rho_0, self.Es)
        w_E = self.trapezoid_weights(self.Es)

        s0 = params['s0'].value
        k_sep = params['k_sep'].value
        k_rnr = params['k_CT_rnr'].value

        def rhs(t, u):
            kE = s0 * self.arrhenius(self.Es, T_fun(t))
            nS, rho = u[0], u[1:]
            q = np.maximum(rho_0 - rho, 0.0) / N_tot  # vacant fraction density; int q in [0, 1]
            CS = k_sep * nS * q
            CR = kE * rho
            dn = I_fun(t) - k_rnr * nS - np.sum(w_E * (CS - CR))
            return np.concatenate(([dn], CS - CR))

        def jac(t, u):
            kE = s0 * self.arrhenius(self.Es, T_fun(t))
            nS, rho = u[0], u[1:]
            q = np.maximum(rho_0 - rho, 0.0) / N_tot
            # d(capture)/d(rho) = -k_sep*nS/N_tot, only where not clipped full
            blocking = np.where(q > 0, k_sep * nS / N_tot, 0.0)
            J = np.zeros((NE + 1, NE + 1))
            J[0, 0] = -k_rnr - k_sep * np.sum(w_E * q)
            J[0, 1:] = w_E * (kE + blocking)
            J[1:, 0] = k_sep * q
            J[idx, idx] = -kE - blocking
            return J

        return rhs, jac

    def process_solution(self, params: Parameters | None = None):
        params = self.params if params is None else params

        exc_state = self.lpl_phase_solution[0, :][:, None]
        self.pair_conc = np.trapezoid(self.lpl_phase_solution[1:, :], self.Es, axis=0)[:, None]

        # fill matrix_opt
        amp = params['amp_CT'].value
        self.matrix_opt = amp * exc_state




class LPLModelST(LPLModel):
    """

    Attributes
    ----------

    Methods
    -------

    """

    name = "LPL model with singlet and triplet states"


    def init_params(self) -> Parameters:
        params = super(LPLModelST, self).init_params()

        # global amplitude for multi-experiment fit
        params.add('amp_S', value=1, min=0, max=np.inf, vary=True)
        params.add('amp_T', value=1, min=0, max=np.inf, vary=True)
        params.add('k_sep', value=1e5, min=0, max=1e10, vary=True) 
        params.add('k_S_rnr', value=1e5, min=0, max=1e10, vary=True) 
        params.add('k_T_rnr', value=1, min=0, max=1e10, vary=True)  
        params.add('k_isc', value=1e2, min=0, max=1e10, vary=True) 
        params.add('k_risc', value=0, min=0, max=1e10, vary=True) 

        return params


    def build_saturable_rhs_jac(self, params: Parameters, T_fun: Callable, I_fun: Callable):
        """RHS and analytic Jacobian of the arrowhead system with a
        *saturable* trapping term (Pauli blocking).

        T_fun(t), I_fun(t): temperature and generation-rate protocols, which
        lets the same system serve isothermal charging, LPL decay, and TL ramps.
        """

        # simulate the current distribution of trap depths
        rho_0 = self.get_rho_0(params)

        NE = len(self.Es)
        n = self.n_species
        idx = np.arange(n, NE + n)
        N_tot = np.trapezoid(rho_0, self.Es)
        w_E = self.trapezoid_weights(self.Es)

        s0 = params['s0'].value
        k_sep = params['k_sep'].value
        k_S_rnr = params['k_S_rnr'].value
        k_T_rnr = params['k_T_rnr'].value
        k_isc = params['k_isc'].value
        k_risc = params['k_risc'].value
        fS = 1 / 4
        fT = 3 / 4

        def rhs(t, u):
            kE = s0 * self.arrhenius(self.Es, T_fun(t))
            nS, nT, rho = u[0], u[1], u[2:]
            q = np.maximum(rho_0 - rho, 0.0) / N_tot  # vacant fraction density; int q in [0, 1]
            CS = k_sep * nS * q
            CR = kE * rho
            rec_sum = (w_E * CR).sum()
            dnS = I_fun(t) - (k_S_rnr + k_isc) * nS - np.sum(w_E * CS) + fS * rec_sum + k_risc * nT 
            dnT =  k_isc * nS - (k_T_rnr + k_risc) * nT + fT * rec_sum

            return np.concatenate(([dnS, dnT], CS - CR))

        def jac(t, u):
            # print("jac called at t =", t)
            kE = s0 * self.arrhenius(self.Es, T_fun(t))
            nS, nT, rho = u[0], u[1], u[2:]
            q = np.maximum(rho_0 - rho, 0.0) / N_tot
            # d(capture)/d(rho) = -k_sep*nS/N_tot where not clipped
            blocking = np.where(q > 0, k_sep * nS / N_tot, 0.0)

            J = np.zeros((NE + 2, NE + 2))
            # dnS row
            J[0, 0] = -(k_S_rnr + k_isc) - k_sep * np.sum(w_E * q)
            J[0, 1] = k_risc
            J[0, 2:] = w_E * (fS * kE + blocking)
            # dnT row
            J[1, 0] = k_isc
            J[1, 1] = -(k_T_rnr + k_risc)
            J[1, 2:] = fT * w_E * kE
            # drho rows
            J[2:, 0] = k_sep * q
            J[idx, idx] = -kE - blocking
            return J

        return rhs, jac

    def process_solution(self, params: Parameters | None = None):
        params = self.params if params is None else params

        exc_state_S = self.lpl_phase_solution[0, :][:, None]
        exc_state_T = self.lpl_phase_solution[1, :][:, None]
        self.pair_conc = np.trapezoid(self.lpl_phase_solution[2:, :], self.Es, axis=0)[:, None]

        # fill matrix_opt
        amp_S = params['amp_S'].value
        amp_T = params['amp_T'].value
        self.matrix_opt = amp_S * exc_state_S + amp_T * exc_state_T
