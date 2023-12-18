from __future__ import annotations

import numpy as np
from scipy.integrate import odeint
from lmfit import Parameters

from abc import abstractmethod
# from numba import njit

from .mathfuncs import blstsq, fi, fit_polynomial_coefs, fit_sum_exp, fold_exp, gaussian, glstsq, lstsq

import matplotlib.pyplot as plt

# from targetmodel import TargetModel
# import glob, os
import scipy.constants as sc
# from scipy.linalg import lstsq

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from ..dataset import Dataset


# abstract class that every model must inherits

# kinetic model class for models which can be solved by variable projection method, 
# all concentration profiles are parametrized by a model and spectra are linearly dependent parameters
class KineticModel(object):
    # species_names = None

    name = '___abstract Kinetic Model____'
    # description = "..."
    # _class = '-class-'

    # _err = 1e-8

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1):
        self.dataset: Dataset = dataset
        self._weights: list[tuple[float, float, float]] = []  # (wl_start, wl_end, weight) default weight 1
        self.n_species: int = n_species
        self.species_names = np.array(list('ABCDEFGHIJKLMNOPQRSTUV'), dtype=str)
        self.params: Parameters = self.init_params()

    @abstractmethod
    def simulate(self) -> np.ndarray:
        pass

    def add_weight(self, w0: float, w1: float, weight: float = 1):
        self._weights.append((w0, w1, weight))

    def _update_params(self):
        """Calls internally init_params and then transfers values from old params to new ones."""

        _params = self.init_params()

        # if self.params is not None and _params is not None:
        for key, par in self.params.items():
            if key in _params:
                _params[key].value = par.value
                _params[key].vary = par.vary
                _params[key].min = par.min
                _params[key].max = par.max
                _params[key].stderr = par.stderr

        self.params = _params

    def init_params(self) -> Parameters:
        return Parameters()

    # def update_n(self, n: int):
    #     if (n == self.n_species):
    #         return
        
    #     self.n_species = n
    #     self._update_params()

    def update_options(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)

        self._update_params()

    def get_species_name(self, i):
        # i is index in range(n)
        return self.species_names[i]

    def get_weights(self):
        weights = np.ones((self.dataset.times.shape[0], self.dataset.wavelengths.shape[0]))
        for *rng, w in self._weights:
            idx0, idx1 = fi(self.dataset.wavelengths, rng)
            weights[:, idx0:idx1+1] *= w

        return weights


class FirstOrderModel(KineticModel):

    name = "First order kinetic model"

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1):
        # more settings
        self.central_wave = 500  # lambda_c, wavelength at central wave, it is necessary for calculation of chirp parameters
        self.include_chirp: bool = True  # if True, model will be fitted with more complex tensor method
        self.chirp_types = ['poly', 'exp']
        self.chirp_type = self.chirp_types[1]  # poly, exp chirp type
        self.num_of_poly_chirp_params = 5
        self.num_of_exp_chirp_params = 2

        self.include_irf = False   # if True, irf will be used to simulate the exponentials
        self.irf_types = ['Gaussian']
        self.irf_type = self.irf_types[0]

        self.include_artifacts = False
        self.artifact_order = 2

        self.include_variable_fwhm = False
        self.variable_fwhm_type = 'poly'  # this cannot be changed
        self.num_of_poly_varfwhm_params = 3

        self.zero_coh_spec_range = []  # zero coherent artifact in that wavelength range

        # self.weight_chirp = False
        # self.w_of_chirp = 0.1
        # self.t_radius_chirp = 0.2  # time radius around chirp / in ps

        super(FirstOrderModel, self).__init__(dataset, n_species)

        # self.update_n()
        # self.ridge_alpha = 0.0001

        # self.C_COH = None
        # self.ST_COH = None

    def init_params(self) -> Parameters:
        params = super(FirstOrderModel, self).init_params()

        params.add('t0', value=0, min=-np.inf, max=np.inf, vary=True)  # time zero at central wave

        if self.include_chirp:
            if self.chirp_type == 'exp':
                for i in range(self.num_of_exp_chirp_params):
                    params.add(f't0_mul_{i+1}', value=0.5, min=-np.inf, max=np.inf, vary=True)
                    params.add(f't0_lam_{i+1}', value=0.01, min=-np.inf, max=np.inf, vary=True)

            else:  # polynomial by Ivo van Stokkum
                for i in range(self.num_of_poly_chirp_params):
                    params.add(f't0_p_{i+1}', value=0.5, min=-np.inf, max=np.inf, vary=True)

        if self.include_irf:
            if self.irf_type == self.irf_types[0]:
                params.add('FWHM', value=0.15, min=0, max=np.inf, vary=True)  # full-width at half maxium of gaussian IRF

            if self.include_variable_fwhm:
                for i in range(self.num_of_poly_varfwhm_params):
                    params.add(f'var_FWHM_p_{i+1}', value=0.01, min=-np.inf, max=np.inf, vary=True)   # wavelength-dependent FWHM

        for i in range(self.n_species):
            params.add(f'tau{i+1}', value=10 ** (i - 1), min=0, max=np.inf, vary=True)

        return params
    
    def _get_rates(self, params: Parameters | None = None) -> np.ndarray:
        if (self.n_species == 0):
            return np.asarray([])
        
        params = self.params if params is None else params

        vals = np.asarray([params[f"tau{i+1}"].value for i in range(self.n_species)])
        return 1 / vals
    
    def _get_fwhm(self, params: Parameters | None = None) -> float:
        params = self.params if params is None else params
        return params["FWHM"].value

    def _get_tau(self, params: Parameters | None = None) -> np.ndarray | float:
        """Return the curve that defines FWHM with respect to wavelength."""

        params = self.params if params is None else params

        if not self.include_irf:
            return 0
        
        fwhm = self._get_fwhm(params)

        if not self.include_variable_fwhm:
            return fwhm
        
        tau = np.ones(self.dataset.wavelengths.shape[0], dtype=np.float64) * fwhm

        partaus = [params[f'var_FWHM_p_{i+1}'] for i in range(self.num_of_poly_varfwhm_params)]

        for i in range(self.num_of_poly_varfwhm_params):
            tau += partaus[i] * ((self.dataset.wavelengths - self.central_wave) / 100) ** (i + 1)

        return tau

    def plot_tau(self):
        if not self.include_irf and not self.include_variable_fwhm:
            return

        plt.plot(self.dataset.wavelengths, self._get_tau())
        plt.xlabel('Wavelength / nm')
        plt.ylabel('IRF_FWHM / ps')
        plt.show()

    def _get_mu(self, params: Parameters | None = None) -> np.ndarray | float:
        """Return the curve that defines chirp (time zero) with respect to wavelength."""

        params = self.params if params is None else params

        t0 = params["t0"].value

        if not self.include_chirp:
            return t0

        mu = np.ones(self.dataset.wavelengths.shape[0], dtype=np.float64) * t0

        x = self.dataset.wavelengths - self.central_wave

        if self.chirp_type == 'exp':
            for i in range(self.num_of_exp_chirp_params):
                factor = params[f"t0_mul_{i + 1}"].value
                lam = params[f"t0_lam_{i + 1}"].value
                mu += factor * np.exp(x * lam)
        elif self.chirp_type == 'poly':
            for i in range(self.num_of_poly_chirp_params):
                p = params[f"t0_p_{i + 1}"].value
                mu += p * (x / 100) ** (i + 1)

        return mu
    
    def estimate_chirp(self, wls_vals: np.ndarray, time_vals: np.ndarray):
        """Estimates the chirp parameters, based on input values as ndarrays"""

        cv = self.central_wave

        if self.chirp_type == 'exp':
            mul, lam = fit_sum_exp(wls_vals - cv, time_vals, self.num_of_exp_chirp_params, fit_intercept=True)
            self.params['t0'].value = mul[-1]
            for i in range(self.num_of_exp_chirp_params):
                self.params[f"t0_mul_{i + 1}"].value = mul[i]
                self.params[f"t0_lam_{i + 1}"].value = lam[i]

        elif self.chirp_type == 'poly':
            coefs = fit_polynomial_coefs(wls_vals - cv, time_vals, self.num_of_poly_chirp_params)
            self.params['t0'].value = coefs[0]
            
            for i in range(self.num_of_poly_chirp_params):
                self.params[f"t0_p_{i + 1}"].value = coefs[i+1]


    # @staticmethod
    # def simulate_model(t, K, j, mu=None, fwhm=0):
    #     # based on Ivo H.M. van Stokkum equation in doi:10.1016/j.bbabio.2004.04.011
    #     L, Q = np.linalg.eig(K)
    #     Q_inv = np.linalg.inv(Q)

    #     A2_T = Q * Q_inv.dot(j)  # Q @ np.diag(Q_inv.dot(j))

    #     _tau = fwhm[:, None, None] if isinstance(fwhm, np.ndarray) else fwhm

    #     if mu is not None:  # TODO !!! pořešit, ať je to obecne
    #         # C = _Femto.conv_exp(t[None, :, None] - mu[:, None, None], -L[None, None, :], _tau)
    #         C = fold_exp(t[None, :, None] - mu[:, None, None], -L[None, None, :], _tau, 0)

    #     else:
    #         # C = _Femto.conv_exp(t[:, None], -L[None, :], fwhm)
    #         C = fold_exp(t[:, None], -L[None, :], fwhm, 0)

    #     return C.dot(A2_T.T)

    def _simulate_artifacts(self, tt: np.ndarray, fwhm: np.ndarray, zero_coh_range=None) -> np.ndarray:

        order = self.artifact_order

        s = fwhm / (2 * np.sqrt(2 * np.log(2)))  # sigma

        y: np.ndarray = gaussian(tt, s)

        y = np.tile(y, (1, 1, order + 1)) if tt.ndim == 3 else np.tile(y, (1, order + 1)) # TODO

        if order > 0:  # first derivative
            y[..., 1] *= -tt.squeeze()

        if order > 1:  # second derivative
            y[..., 2] *= (tt * tt - s * s).squeeze()

        if order > 2:  # third derivative
            y[..., 3] *= (-tt * (tt * tt - 3 * s * s)).squeeze()

        if order > 3:  # fourth derivative
            y[..., 4] *= (tt ** 4 - 6 * tt * tt * s * s + 3 * s ** 4).squeeze()

        y_max = np.max(y, axis=-2, keepdims=True)  # find maxima over time axis
        y_max[np.isclose(y_max, 0)] = 1  # values close to zero force to 1 to not divide by zero
        y /= y_max

        return y

        # self.C_COH = y

        # if zero_coh_range is not None:
        #     self.C_COH *= zero_coh_range[:, None, None]

        # return self.C_COH

    # def get_weights(self, params=None):
    #     weights = super(_Femto, self).get_weights()
    #     if self.weight_chirp:
    #         mu = self.get_mu(params)

    #         for i, t0 in enumerate(mu):
    #             idx0, idx1 = find_nearest_idx(self.times, [t0 - self.t_radius_chirp / 2, t0 + self.t_radius_chirp / 2])
    #             weights[idx0:idx1+1, i] *= self.w_of_chirp

    #     return weights


    # def simulate_C_tensor(self, params=None):
    #     if params is None:
    #         params = self.params

    #     _C_tensor = self.calc_C(params)
    #     # n = _C_tensor.shape[-1]
    #     # ST = np.zeros((n + (self.coh_spec_order + 1 if self.coh_spec else 0), self.wavelengths.shape[0]))

    #     zero_coh_range = np.ones_like(self.wavelengths)
    #     for rng in self.zero_coh_spec_range:
    #         idx0, idx1 = find_nearest_idx(self.wavelengths, rng)
    #         zero_coh_range[idx0:idx1+1] = 0

    #     if self.coh_spec:
    #         _C_COH = self.simulate_coh_gaussian(zero_coh_range=zero_coh_range)
    #         _C_tensor = np.concatenate((_C_tensor, _C_COH), axis=-1) if _C_tensor is not None else _C_COH

    #     _C_tensor = np.nan_to_num(_C_tensor)

    #     return _C_tensor


    # def simulate_mod(self, D, params=None):
    #     if D is None:
    #         raise ValueError('param D cannot be None')

    #     if params is None:
    #         params = self.params

    #     _C_tensor = self.simulate_C_tensor(params)

    #     ST, D_fit = blstsq(_C_tensor, D.T, self.ridge_alpha)  # solve batched least squares problem

    #     if self.coh_spec:
    #         self.ST_COH = ST[-self.coh_spec_order - 1:]

    #     # D_fit = np.matmul(_C_tensor, ST.T[..., None]).squeeze().T

    #     C = _C_tensor[0, :, :-self.coh_spec_order - 1] if self.coh_spec else _C_tensor[0]
    #     ST = ST[:-self.coh_spec_order - 1] if self.coh_spec else ST

    #     D_fit = np.nan_to_num(D_fit)
    #     return D_fit, C, ST

    def calculate_LDM_ridge(self, lifetimes: np.ndarray, ridge_alpha: float = 1) -> tuple[np.ndarray, np.ndarray]:
        """Calculates lifetime density map according to given lifetimes, ridge alpha and current settings such as 
        chirp, partau, fwhm, artifacts..."""
        mu = self._get_mu()
        tensor: bool = isinstance(mu, np.ndarray)
        fwhm = self._get_tau()  # fwhm
        _tau = fwhm[:, None, None] if isinstance(fwhm, np.ndarray) else fwhm
        _mu = mu[:, None, None] if tensor else mu
        _t = self.dataset.times[None, :, None] if tensor else self.dataset.times[:, None]
        tt = _t - _mu

        ks = 1 / lifetimes
        _ks = ks[None, None, :] if tensor else ks[None, :]

        C: np.ndarray = fold_exp(tt, _ks, _tau)

        if self.include_artifacts:
            C_artifacts = self._simulate_artifacts(tt, fwhm)
            C = np.concatenate((C_artifacts, C), axis=-1)

        coefs, D_fit = glstsq(C, self.dataset.matrix_fac.T, ridge_alpha)

        # coefs = ST
        return coefs, D_fit

    def simulate(self, params: Parameters | None = None) -> np.ndarray:
        """Simulates concentration profiles, including coherent artifacts if setup in a model."""
        params = self.params if params is None else params

        ks = self._get_rates(params)
        mu = self._get_mu(params)
        fwhm = self._get_tau(params)  # fwhm

        # if True, partitioned variable projection will be used for fitting
        tensor: bool = isinstance(mu, np.ndarray)

        _tau = fwhm[:, None, None] if isinstance(fwhm, np.ndarray) else fwhm
        _mu = mu[:, None, None] if tensor else mu
        _t = self.dataset.times[None, :, None] if tensor else self.dataset.times[:, None]
        tt = _t - _mu

        C_artifacts = None
        if self.include_artifacts:
            C_artifacts = self._simulate_artifacts(tt, fwhm)

        # simulate only artifacts
        if self.n_species == 0 and C_artifacts is not None:
            return C_artifacts

        _ks = ks[None, None, :] if tensor else ks[None, :]
        
        # simulation for DADS only
        # EADS can be then recalculated from EADS
        C: np.ndarray = fold_exp(tt, _ks, _tau)

        if C_artifacts is not None:
            C = np.concatenate((C_artifacts, C), axis=-1)

        return C


# class PumpProbeCrossCorrelation(_Femto):

#     name = 'Pump-Probe Cross-Correlation'
#     _class = 'Femto'

#     def open_model_settings(self, show_target_model=False):
#         super(PumpProbeCrossCorrelation, self).open_model_settings(False)

#     def calc_C(self, params=None, C_out=None):
#         super(PumpProbeCrossCorrelation, self).calc_C(params, C_out)

#         return None


# class Global_Analysis_Femto(_Femto):

#     name = 'Global Analysis'
#     _class = 'Femto'
#     use_numpy = True

#     def init_model_params(self):
#         params = super(Global_Analysis_Femto, self).init_model_params()

#         # evolution model
#         if self.spectra == 'EADS':
#             self.species_names = [f'EADS{i + 1}' for i in range(self.n)]
#             for i in range(self.n):
#                 # sec_label = self.species_names[i+1] if i < self.n - 1 else ""
#                 params.add(f'tau_{self.species_names[i]}', value=10**(i-1), min=0, max=np.inf)

#         else:  # decay model
#             self.species_names = [f'DADS{i + 1}' for i in range(self.n)]
#             for i in range(self.n):
#                 params.add(f'tau_{self.species_names[i]}', value=10**(i-1), min=0, max=np.inf)

#         return params

#     def open_model_settings(self, show_target_model=False):
#         super(Global_Analysis_Femto, self).open_model_settings(False)


#     def calc_C(self, params=None, C_out=None):
#         super(Global_Analysis_Femto, self).calc_C(params, C_out)

#         fwhm, ks = self.get_kin_pars(params)
#         mu = self.get_mu(params)
#         n = self.n
#         fwhm = self.get_tau(params)  # fwhm

#         if self.spectra == 'EADS':
#             K = np.zeros((n, n))
#             for i in range(n):
#                 K[i, i] = -ks[i]
#                 if i < n - 1:
#                     K[i + 1, i] = ks[i]

#             j = np.zeros(n)
#             j[0] = 1
#             self.C = self.simulate_model(self.times, K, j, mu, fwhm)

#         else:  # for DADS
#             _tau = fwhm[:, None, None] if isinstance(fwhm, np.ndarray) else fwhm
#             self.C = fold_exp(self.times[None, :, None] - mu[:, None, None], ks[None, None, :], _tau, 0)

#         return self.get_conc_matrix(C_out, self._connectivity)


# class Target_Analysis_Femto(_Femto):

#     name = 'Target Analysis'
#     _class = 'Femto'

#     def init_model_params(self):
#         params = super(Target_Analysis_Femto, self).init_model_params()

#         if self.target_model:
#             for par_name, rate in self.target_model.get_names_rates():
#                 par_name = 'tau' + par_name[1:]
#                 params.add(par_name, value=1/rate, min=0, max=np.inf)

#         return params

#     def open_model_settings(self, show_target_model=False):
#         super(Target_Analysis_Femto, self).open_model_settings(show_target_model=True)

#     def calc_C(self, params=None, C_out=None):
#         super(Target_Analysis_Femto, self).calc_C(params, C_out)

#         fwhm, ks = self.get_kin_pars(params)
#         mu = self.get_mu(params)
#         n = self.n
#         fwhm = self.get_tau(params)  # fwhm

#         if self.j is None:
#             self.j = np.zeros(n)
#             self.j[0] = 1

#         self.target_model.set_rates(ks)
#         K = self.target_model.build_K_matrix()

#         self.C = self.simulate_model(self.times, K, self.j, mu, fwhm)

#         return self.get_conc_matrix(C_out, self._connectivity)


# class Target_Analysis_Z_Femto(_Femto):

#     name = 'Target Analysis Z isomer'
#     _class = 'Femto'

#     def __init__(self, times=None, connectivity=(0, 1, 2), wavelengths=None, method='femto'):
#         super(Target_Analysis_Z_Femto, self).__init__(times=times,
#                                                       connectivity=connectivity,
#                                                       wavelengths=wavelengths,
#                                                       method=method)

#         self.solvation = True
#         self.n_upsample = 3

#     def init_model_params(self):
#         params = super(Target_Analysis_Z_Femto, self).init_model_params()

#         # self.params.add('phi', value=0.5, min=0, max=1, vary=False)
#         params.add('tau_AB', value=0.25, min=0, max=np.inf)
#         params.add('tau_BA', value=0.50, min=0, max=np.inf)
#         params.add('tau_AB_C', value=5.65, min=0, max=np.inf)
#         params.add('tau_CD', value=14.5, min=0, max=np.inf)
#         params.add('tau_sol', value=1.9, min=0, max=np.inf)
#         params.add('tau_diff', value=0.92, min=0, max=np.inf)

#         return params

#     def solvation_rates(self, t, k_AB, k_BA, k_diff, k_sol):
#         _k_AB = k_AB + (k_diff * (1 - np.exp(-t * k_sol)) if self.solvation else 0)
#         _k_BA = k_BA - (k_diff * (1 - np.exp(-t * k_sol)) if self.solvation else 0)

#         return _k_AB, _k_BA

#     def plot_solvation_rates(self):
#         fwhm, ks = self.get_kin_pars(self.params)
#         k_AB, k_BA, k_ABC, k_CD, k_sol, k_diff = ks
#         _k_AB, _k_BA = self.solvation_rates(self.times, k_AB, k_BA, k_diff, k_sol)

#         plt.plot(self.times, _k_AB, label='$k_{AB}$')
#         plt.plot(self.times, _k_BA, label='$k_{BA}$')
#         plt.show()

#     @staticmethod
#     def gauss(t, fwhm=1):
#         assert fwhm != 0
#         sigma = fwhm / (2 * np.sqrt(2 * np.log(2)))  # https://en.wikipedia.org/wiki/Gaussian_function
#         return np.exp(-t * t / (2 * sigma * sigma)) / (sigma * np.sqrt(2 * np.pi))

#     @staticmethod
#     def upsample_points(x, n=3):
#         t_u = []
#         for t1, t2 in zip(x[:-1], x[1:]):
#             t_diff = t2 - t1
#             for i in range(n):
#                 t_u.append(t1 + t_diff * i / n)
#         t_u.append(x[-1])
#         return np.asarray(t_u)

#     @staticmethod
#     @njit(fastmath=True)
#     def func_nb(c, t, j, t0, fwhm, rates, K_temp):
#         k_AB, k_BA, k_ABC, k_CD, k_sol, k_diff = rates
#         _t = t - t0

#         _k_AB = k_AB + k_diff * (1 - np.exp(-_t * k_sol))
#         _k_BA = k_BA - k_diff * (1 - np.exp(-_t * k_sol))

#         K_temp[0, 0] = -_k_AB - k_ABC
#         K_temp[0, 1] = _k_BA
#         K_temp[1, 0] = _k_AB
#         K_temp[1, 1] = -_k_BA - k_ABC

#         sigma = fwhm / (2 * np.sqrt(2 * np.log(2)))
#         gauss = np.exp(-_t * _t / (2 * sigma * sigma)) / (sigma * np.sqrt(2 * np.pi))

#         return K_temp.dot(c) + j * gauss


#     def calc_C(self, params=None, C_out=None):
#         super(Target_Analysis_Z_Femto, self).calc_C(params, C_out)

#         fwhm, ks = self.get_kin_pars(params)
#         mu = self.get_mu(params)
#         n = self.n  # n must be 4
#         fwhm = self.get_tau(params)  # fwhm

#         k_AB, k_BA, k_ABC, k_CD, k_sol, k_diff = ks

#         K = np.asarray([[-k_AB - k_ABC, k_BA, 0, 0],
#                         [k_AB, -k_BA - k_ABC, 0, 0],
#                         [k_ABC, k_ABC, -k_CD, 0],
#                         [0, 0, k_CD, 0]])

#         # def func(c, t, j, t0, fwhm):
#         #     _k_AB, _k_BA = self.solvation_rates(t - t0, k_AB, k_BA, k_diff, k_sol)
#         #
#         #     K = np.asarray([[-_k_AB - k_ABC, _k_BA, 0, 0],
#         #                     [_k_AB,   -_k_BA - k_ABC,  0, 0],
#         #                     [k_ABC, k_ABC, -k_CD, 0],
#         #                     [0,        0,  k_CD, 0]])
#         #     return K.dot(c) + j * self.gauss(t - t0, fwhm)

#         j = np.zeros(n)
#         j[0] = 1

#         t_upsampled = self.upsample_points(self.times, self.n_upsample) if self.n_upsample > 1 else self.times

#         self.C = np.zeros((mu.shape[0], self.times.shape[0], n), dtype=np.float64)

#         # with ProcessPoolExecutor() as exe:
#         #     exe.submit()

#         for i in range(mu.shape[0]):
#             _fwhm = fwhm[i] if isinstance(fwhm, np.ndarray) else fwhm
#             # self.C[i, ...] = odeint(func, np.zeros(n), t_upsampled, args=(j, mu[i], _fwhm))[::self.n_upsample]
#             self.C[i, ...] = odeint(self.func_nb, np.zeros(n), t_upsampled, args=(j, mu[i], _fwhm, ks, K))[::self.n_upsample]


#         return self.get_conc_matrix(C_out, self._connectivity)


# class Firt_Order_Model_Nano(Model):
#     name = 'Sequential/parallel model (1st order)'
#     _class = 'Nano'

#     def __init__(self, times=None, connectivity=(0, 1, 2), wavelengths=None, C=None):
#         super(Firt_Order_Model_Nano, self).__init__(times, connectivity, wavelengths, C)

#         self.use_irf = False
#         self.irf_types = ['Gaussian']
#         self.irf_type = self.irf_types[0]
#         self.models = ['Sequential', 'Parallel']
#         self.model_type = self.models[0]

#     def open_model_settings(self, show_target_model=False):
#         if GenericInputDialog.if_opened_activate():
#             return

#         cbuse_irf = QCheckBox('Use IRF (instrument response function)')
#         cbuse_irf.setChecked(self.use_irf)

#         cbIRF_type = QComboBox()
#         cbIRF_type.addItems(self.irf_types)
#         cbIRF_type.setCurrentIndex(self.irf_types.index(self.irf_type))

#         cbmodel_type = QComboBox()
#         cbmodel_type.addItems(self.models)
#         cbmodel_type.setCurrentIndex(self.models.index(self.model_type))

#         widgets = [[cbuse_irf, None],
#                    ['IRF type:', cbIRF_type],
#                    ["Used kinetic model:", cbmodel_type],
#                    ]

#         def set_result():
#             self.use_irf = cbuse_irf.isChecked()
#             self.irf_type = self.irf_types[cbIRF_type.currentIndex()]
#             self.model_type = self.models[cbmodel_type.currentIndex()]
#             self.init_params()

#         self.model_settigs_dialog = GenericInputDialog(widget_list=widgets, label_text="",
#                                                        title=f'{self.name} settings',
#                                                        set_result=set_result)
#         self.model_settigs_dialog.show()
#         self.model_settigs_dialog.exec()

#     def init_model_params(self):
#         params = Parameters()
#         params.add('c0', value=1, min=0, max=np.inf, vary=False)
#         params.add('t0', value=0, min=-np.inf, max=np.inf)  # time zero

#         if self.use_irf and self.irf_type == 'Gaussian':
#             params.add('IRF_FWHM', value=0.2, min=0, max=np.inf)

#         for i in range(self.n):
#             sec_label = self.species_names[i + 1] if i < self.n - 1 else ""
#             params.add(f'tau_{self.species_names[i]}{sec_label}', value=1 + i ** 2, min=0, max=np.inf)

#         return params

#     @staticmethod
#     def get_EAS(ks, C_base):
#         # based on Ivo H.M. van Stokkum equation in doi:10.1016/j.bbabio.2004.04.011
#         # c_l = sum_{j=1}^l  b_jl * exp(-k_j * t)
#         # for j < l: b_jl = b_{j, l-1} * k_{l-1} / (k_l - k_j)
#         n = ks.shape[0]
#         # C = np.exp(-t[:, None] * ks[None, :])
#         if n == 1:
#             return C_base

#         bjl = np.triu(np.ones((n, n)))  # make triangular upper matrix

#         k_prod = np.cumprod(ks[:-1])  # products of rate constants

#         k_mat = ks[None, :] - ks[:, None]  # differences between rate constants
#         k_mat[k_mat == 0] = 1  # set zero differences to 1, because of calculation of products
#         k_mat = np.cumprod(k_mat, axis=1)  # make product of them
#         k_mat[:, 1:] = k_prod / k_mat[:, 1:]  # combine with rate constants

#         bjl *= k_mat

#         return C_base.dot(bjl)

#     def calc_C(self, params=None, C_out=None):
#         super(Firt_Order_Model_Nano, self).calc_C(params, C_out)

#         if self.use_irf:
#             c0, t0, irf_fwhm, *taus = [par[1].value for par in self.params.items()]
#         else:
#             c0, t0, *taus = [par[1].value for par in self.params.items()]

#         ks = 1 / np.asarray(taus)

#         self.C = c0 * fold_exp(self.times[:, None], ks[None, :], irf_fwhm if self.use_irf else 0, t0)
#         if self.model_type == 'Sequential':
#             self.C = self.get_EAS(ks, self.C)

#         return self.get_conc_matrix(C_out, self._connectivity)


# class First_Order_Target_Model(Model):

#     name = 'Target model (1st order)'
#     _class = 'Nano'

#     def init_model_params(self):
#         params = Parameters()
#         params.add('c0', value=1, min=0, max=np.inf, vary=False)

#         if self.target_model:
#             for par_name, rate in self.target_model.get_names_rates():
#                 params.add(par_name, value=rate, min=0, max=np.inf)

#         return params

#     def open_model_settings(self, show_target_model=False):
#         if GenericInputDialog.if_opened_activate():
#             return

#         widgets = []
#         models, cbModel = self.setup_target_models(widgets)

#         def set_result():
#             self.target_model = TargetModel.load(models[cbModel.currentIndex()])
#             self.species_names = self.target_model.get_compartments()
#             self.init_params()

#         self.model_settigs_dialog = GenericInputDialog(widget_list=widgets, label_text="",
#                                                        title=f'{self.name} settings',
#                                                        set_result=set_result)
#         self.model_settigs_dialog.show()
#         self.model_settigs_dialog.exec()

#     def calc_C(self, params=None, C_out=None):
#         super(First_Order_Target_Model, self).calc_C(params, C_out)

#         c0, *ks = [par[1].value for par in self.params.items()]

#         self.target_model.set_rates(ks)
#         K = self.target_model.build_K_matrix()
#         # print(K)

#         if self.j is None or self.j.shape[0] != K.shape[0]:
#             self.j = np.zeros(K.shape[0])
#             self.j[0] = 1

#         self.C = get_target_C_profile(self.times, K, self.j * c0)

#         return self.get_conc_matrix(C_out, self._connectivity)
