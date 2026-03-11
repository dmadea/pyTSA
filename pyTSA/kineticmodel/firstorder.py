from __future__ import annotations

import numpy as np
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..dataset import Dataset

from .kineticmodel import BaseKineticModel
from ..mathfuncs import fold_exp_vec, glstsq, square_conv_exp_vec, simulate_target_model, LPL_decay, exp_dist, reshape_arrays

from lmfit import Parameters
from typing import Callable

import matplotlib.pyplot as plt


class FirstOrderModel(BaseKineticModel):
    """
    First order kinetic model
    ----------

    Methods
    -------

    """

    name = "First order kinetic model"

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1, set_model: bool = False):

        self._include_rates_params = True

        self.LDM: np.ndarray | None = None
        self.LDM_fit: np.ndarray | None = None
        self.LDM_lifetimes: np.ndarray | None = None

        super(FirstOrderModel, self).__init__(dataset, n_species, set_model)

    def init_params(self) -> Parameters:
        params = super(FirstOrderModel, self).init_params()

        if self._include_rates_params:
            for i in range(self.n_species):
                params.add(f'tau_{i+1}', value=10 ** (i - 1), min=0, max=np.inf, vary=True)
                params.add(f'b_{i+1}', value=0, min=0, max=np.inf, vary=False)    # describe the dispersion width for the non-exponential kinetics, 0 -> classical exponential

        return params
    
    def plot_lifetime_distribution(self, index: int = 1, t_unit: str = 'ps', xscale: str = 'log', lower_factor: float = 1e-5, upper_factor: float = 1e2):

        tau0 = self.params[f'tau_{index}'].value
        b = self.params[f'b_{index}'].value

        if b == 0:
            return 
        
        taus = np.logspace(np.log10(tau0 * lower_factor), np.log10(tau0 * upper_factor), 1000)

        p = 1 / (taus * b * np.sqrt(2 * np.pi)) * np.exp(-np.log(taus / tau0) ** 2 / (2 * b ** 2))

        print("tau@maximum:", taus[np.argmax(p)])

        plt.plot(taus, p, lw=1.5, color='red')
        plt.xlabel(f'Lifetime / {t_unit}')
        plt.ylabel('Amplitude')
        plt.xscale(xscale)
        plt.show()

    def get_rates(self, params: Parameters | None = None) -> np.ndarray:
        if (self.n_species == 0 or not self._include_rates_params):
            return np.asarray([])
        
        params = self.params if params is None else params

        vals = np.asarray([params[f"tau_{i+1}"].value for i in range(self.n_species)])
        return 1 / vals
    
    def get_b_array(self, params: Parameters | None = None) -> np.ndarray:
        if (self.n_species == 0 or not self._include_rates_params):
                return np.asarray([])
        
        params = self.params if params is None else params

        return np.asarray([params[f"b_{i+1}"].value for i in range(self.n_species)])


    def calculate_LDM(self, log_range: tuple[float, float], n: int, ridge_alpha: float = 1) -> tuple[np.ndarray, np.ndarray]:
        """Calculates lifetime density map according to given lifetimes, ridge alpha and current settings such as 
        chirp, partau, fwhm, artifacts..."""

        lifetimes = np.logspace(log_range[0], log_range[1], num=n, endpoint=True)

        mu = self.get_mu()
        width = self.get_tau()  # fwhm
        ks = 1 / lifetimes

        tt, k, width_r, _ = reshape_arrays(self.dataset.times, ks, width, mu=mu)
        C: np.ndarray = fold_exp_vec(tt, k, width_r)

        if self.include_artifacts:
            C_artifacts = self._simulate_artifacts(self.dataset.times, mu, width)
            C = np.concatenate((C_artifacts, C), axis=-1)

        w = self.get_weights_lstsq()
        coefs, D_fit = glstsq(C, self.dataset.matrix_fac, ridge_alpha, w)

        if self.include_artifacts:
            coefs = coefs[self.artifact_order + 1:]

        self.LDM = coefs
        self.LDM_fit = D_fit
        self.LDM_lifetimes = lifetimes

        # coefs = ST
        return coefs, D_fit

    def get_exp_function(self) -> Callable[[np.ndarray | float, np.ndarray | float, np.ndarray | float], np.ndarray | float]:
        return fold_exp_vec if self.irf_type == self.irf_types[0] else square_conv_exp_vec


    def calculate_C_profiles(self, params: Parameters | None = None, times: np.ndarray | None = None):
        """Simulates concentration profiles, including coherent artifacts if setup in a model.
        
        if times arg is not None, these values will be used to simulate C profiles from
        
        """

        times = times if times is not None else self.dataset.times

        ks = self.get_rates(params)
        mu = self.get_mu(params)
        width = self.get_tau(params)  # fwhm or width
        b = self.get_b_array(params)

        if self.n_species == 0:
            return
        
        # # simulation for DADS only
        f = self.get_exp_function()
        self.C_opt: np.ndarray = exp_dist(f, times, ks, width, b, mu)


class FirstOrderLPLModel(FirstOrderModel):

    name = "First order kinetic model with optional LPL profile"

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1, set_model: bool = False):
        self.include_LPL = True
        super(FirstOrderLPLModel, self).__init__(dataset, n_species, set_model)
        self._calculate_EAS = False

    def init_params(self) -> Parameters:
        params = super(FirstOrderLPLModel, self).init_params()

        if self.include_LPL:
            params.add('LPL_slope', value=1, min=0.1, max=10, vary=True)

        return params
    
    def get_labels(self, t_unit='ps'):
        labels = super().get_labels(t_unit)
        return labels + ['LPL'] if self.include_LPL else labels
        

    def calculate_C_profiles(self, params: Parameters | None = None):
        super(FirstOrderLPLModel, self).calculate_C_profiles(params)

        if not self.include_LPL:
            return
        
        params = self.params if params is None else params

        m = params['LPL_slope'].value
        trace = LPL_decay(self.dataset.times - params['t0'].value, m)
        self.C_opt = np.hstack((self.C_opt, trace[:, None]))
