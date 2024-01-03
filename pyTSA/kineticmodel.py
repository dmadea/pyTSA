from __future__ import annotations
import os
# from matplotlib.ticker import AutoLocator, MultipleLocator, ScalarFormatter

# from functools import partial

import numpy as np
# from scipy.integrate import odeint
from lmfit import Parameters, Minimizer
from lmfit.minimizer import MinimizerResult

from abc import abstractmethod

# from .fit import Fitter
# from numba import njit

from mathfuncs import LPL_decay, blstsq, fi, fit_polynomial_coefs, fit_sum_exp, fold_exp, gaussian, get_EAS_transform, glstsq, lstsq

import matplotlib.pyplot as plt

# from targetmodel import TargetModel
# import glob, os
import scipy.constants as sc
# from scipy.linalg import lstsq

from typing import TYPE_CHECKING

from plot import plot_SADS_ax, plot_data_ax, plot_traces_onefig_ax
if TYPE_CHECKING:
    from .dataset import Dataset


# abstract class that every model must inherits

# kinetic model class for models which can be solved by variable projection method, 
# all concentration profiles are parametrized by a model and spectra are linearly dependent parameters
class KineticModel(object):
    name = '___abstract Kinetic Model____'
    # description = "..."
    # _class = '-class-'

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1):
        self.dataset: Dataset = dataset
        self._weights: list[tuple[float, float, float]] = []  # (wl_start, wl_end, weight) default weight 1, # additional weights
        self.n_species: int = n_species
        self.species_names = np.array(list('ABCDEFGHIJKLMNOPQRSTUV'), dtype=str)
        self.params: Parameters = self.init_params()

        self.C_opt: np.ndarray | None = None
        self.ST_opt: np.ndarray | None = None
        self.matrix_opt: np.ndarray | None = None

        self.minimizer: Minimizer | None = None
        self.fit_result: MinimizerResult | None = None
        # fitter arguments to the underlying fitting algorithm
        self.fitter_kwds = dict(ftol=1e-10, xtol=1e-10, gtol=1e-10, loss='linear', verbose=2, jac='3-point')

        # if set, the std will be calculated for each time point in this range and used for weighting of each spectrum as 1/std
        self.noise_range: None | tuple[float, float] = None   

        self.fit_algorithm = "least_squares"  # trust reagion reflective alg.

    @abstractmethod
    def plot(self, *what: str, nrows: int = 1, ncols: int = None, **kwargs):
        pass

    @abstractmethod
    def simulate(self):
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
                _params[key].brute_step = par.brute_step
                _params[key].correl = par.correl
                _params[key].init_value = par.init_value
                _params[key].expr = par.expr
                _params[key].user_data = par.user_data

        self.params = _params

    def init_params(self) -> Parameters:
        return Parameters()
    
    @abstractmethod
    def fit(self):
        pass

    def update_options(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)

        self._update_params()

    def get_species_name(self, i):
        # i is index in range(n)
        return self.species_names[i]

    def get_weights_lstsq(self):
        if self.noise_range is None:
            return None
        
        i, j = fi(self.dataset.wavelengths, self.noise_range)
        stds = np.std(self.dataset.matrix_fac[:, i:j+1], axis=1)
        return 1 / stds


    def get_weights(self):
        weights = np.ones((self.dataset.times.shape[0], self.dataset.wavelengths.shape[0]))

        # https://gregorygundersen.com/blog/2022/08/09/weighted-ols/
        if self.noise_range:
            assert len(self.noise_range) == 2
            i, j = fi(self.dataset.wavelengths, self.noise_range)

            stds = np.std(self.dataset.matrix_fac[:, i:j+1], axis=1)
            weights *= 1 / stds[:, None]

        for *rng, w in self._weights:
            i, j = fi(self.dataset.wavelengths, rng)
            weights[:, i:j+1] *= w

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

        self.ridge_alpha = 0.0001

        # concentration profiles and spectra of coherent artifacts
        self.C_artifacts: np.ndarray | None = None
        self.ST_artifacts: np.ndarray | None = None
        
        # for C_opt and ST_opt, decay profiles and DAS will be plotted
        # for EAS, new variables are defined
        self.C_EAS: np.ndarray | None = None
        self.ST_EAS: np.ndarray | None = None

        self.LDM: np.ndarray | None = None
        self.LDM_fit: np.ndarray | None = None
        self.LDM_lifetimes: np.ndarray | None = None

        # self.weight_chirp = False
        # self.w_of_chirp = 0.1
        # self.t_radius_chirp = 0.2  # time radius around chirp / in ps
        self._calculate_EAS = True

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
            params.add(f'tau_{i+1}', value=10 ** (i - 1), min=0, max=np.inf, vary=True)

        return params
    
    def get_rates(self, params: Parameters | None = None) -> np.ndarray:
        if (self.n_species == 0):
            return np.asarray([])
        
        params = self.params if params is None else params

        vals = np.asarray([params[f"tau_{i+1}"].value for i in range(self.n_species)])
        return 1 / vals
    
    def get_fwhm(self, params: Parameters | None = None) -> float:
        params = self.params if params is None else params
        return params["FWHM"].value

    def get_tau(self, params: Parameters | None = None) -> np.ndarray | float:
        """Return the curve that defines FWHM with respect to wavelength."""

        params = self.params if params is None else params

        if not self.include_irf:
            return 0
        
        fwhm = self.get_fwhm(params)

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

        plt.plot(self.dataset.wavelengths, self.get_tau())
        plt.xlabel('Wavelength / nm')
        plt.ylabel('IRF_FWHM / ps')
        plt.show()

    def get_mu(self, params: Parameters | None = None) -> np.ndarray | float:
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
    
    def estimate_chirp(self, wls_vals: np.ndarray | list[float], time_vals: np.ndarray | list[float]):
        """Estimates the chirp parameters, based on input values as ndarrays"""

        if not self.include_chirp:
            raise TypeError("Model does not have chirp parameters. include_chirp == False")

        wls_vals = np.asarray(wls_vals)
        time_vals = np.asarray(time_vals)

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


    def _simulate_artifacts(self, tt: np.ndarray, fwhm: np.ndarray, zero_coh_range=None) -> np.ndarray:

        order = self.artifact_order

        s = fwhm / (2 * np.sqrt(2 * np.log(2)))  # sigma

        y: np.ndarray = gaussian(tt, s)

        y = np.tile(y, (1, 1, order + 1)) if tt.ndim == 3 else np.tile(y, (1, order + 1))

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

    def calculate_LDM(self, log_range: tuple[float, float], n: int, ridge_alpha: float = 1) -> tuple[np.ndarray, np.ndarray]:
        """Calculates lifetime density map according to given lifetimes, ridge alpha and current settings such as 
        chirp, partau, fwhm, artifacts..."""

        lifetimes = np.logspace(log_range[0], log_range[1], num=n, endpoint=True)

        mu = self.get_mu()
        fwhm = self.get_tau()  # fwhm
        tensor: bool = isinstance(mu, np.ndarray) or isinstance(fwhm, np.ndarray)
        _tau = fwhm[:, None, None] if isinstance(fwhm, np.ndarray) else fwhm
        _mu = mu[:, None, None] if isinstance(mu, np.ndarray) else mu
        _t = self.dataset.times[None, :, None] if tensor else self.dataset.times[:, None]
        tt = _t - _mu

        ks = 1 / lifetimes
        _ks = ks[None, None, :] if tensor else ks[None, :]

        C: np.ndarray = fold_exp(tt, _ks, _tau)

        if self.include_artifacts:
            C_artifacts = self._simulate_artifacts(tt, fwhm)
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
    
    def simulate(self, params: Parameters | None = None):

        self.calculate_C_profiles(params)

        if self.C_opt is None and self.C_artifacts is None:
            return
        
        if self.C_opt is None:
            C_full = self.C_artifacts
        elif self.C_artifacts is None:
            C_full = self.C_opt
        else:
            C_full: np.ndarray = np.concatenate((self.C_artifacts, self.C_opt), axis=-1)

        w = self.get_weights_lstsq()

        ST_full, self.matrix_opt = glstsq(C_full, self.dataset.matrix_fac, self.ridge_alpha, w)

        if self.include_artifacts:
            n = self.C_artifacts.shape[-1]
            self.ST_artifacts = ST_full[:n]
            if self.n_species > 0:
                self.ST_opt = ST_full[n:]
        else:
            self.ST_opt = ST_full

        if self._calculate_EAS:
            # calculation of EAS profiles and spectra
            ks = self.get_rates(params)
            A = get_EAS_transform(ks)
            self.C_EAS = self.C_opt.dot(A)
            self.ST_EAS = np.linalg.inv(A).dot(self.ST_opt)

        
    def calculate_C_profiles(self, params: Parameters | None = None):
        """Simulates concentration profiles, including coherent artifacts if setup in a model."""
        params = self.params if params is None else params
        self.C_opt = None
        self.C_artifacts = None

        ks = self.get_rates(params)
        mu = self.get_mu(params)
        fwhm = self.get_tau(params)  # fwhm

        # if True, partitioned variable projection will be used for fitting
        tensor: bool = isinstance(mu, np.ndarray) or isinstance(fwhm, np.ndarray)

        _tau = fwhm[:, None, None] if isinstance(fwhm, np.ndarray) else fwhm
        _mu = mu[:, None, None] if isinstance(mu, np.ndarray) else mu
        _t = self.dataset.times[None, :, None] if tensor else self.dataset.times[:, None]
        tt = _t - _mu

        if self.include_artifacts:
            self.C_artifacts = self._simulate_artifacts(tt, fwhm)

        if self.n_species == 0:
            return

        _ks = ks[None, None, :] if tensor else ks[None, :]
        
        # simulation for DADS only
        self.C_opt: np.ndarray = fold_exp(tt, _ks, _tau)


    def fit(self):
        def residuals(params):
            self.simulate(params)
            R = self.dataset.matrix_fac - self.matrix_opt
            weights = self.get_weights()
            return R * weights

        # iter_cb - callback function
        self.minimizer = Minimizer(residuals, self.params, nan_policy='omit') #,
                                        #  iter_cb=lambda params, iter, resid, *args, **kws: self.is_interruption_requested())
        
        self.fit_result = self.minimizer.minimize(method=self.fit_algorithm, **self.fitter_kwds)  # minimize the residuals
        self.params = self.fit_result.params

    def plot(self, *what: str, nrows: int | None = None, ncols: int | None = None, **kwargs):
        """
        
        
        
        """
        # what is list of figures to plot
        # data, traces, EADS, DADS, LDM, residuals

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

        fig, axes = plt.subplots(nrows, ncols, figsize=kwargs.get('figsize', (5.5 * ncols, 4.5 * nrows)))
        if nrows * ncols == 1:
            axes = np.asarray([axes])

        mu = self.get_mu()
        COLORS = ['blue', 'red', 'green', 'orange', 'purple', 'black', 'gray']
        t_unit=kwargs.get('t_unit', 'ps')

        def update_kwargs(prefix: str, kwargs: dict):
            for key, value in kwargs.copy().items():
                if key.startswith(prefix.lower()):
                    _key = key[len(prefix) + 1:]  # to account for _ symbol
                    kwargs[_key] = value

        for i, p in enumerate(what):
            if i >= nrows * ncols:
                break

            ax = axes.flat[i]
            kws = kwargs.copy()
            match p.lower():
                case "data":
                    kws.update(dict(title=f"Data [{self.dataset.name}]", log=False, mu=mu))
                    update_kwargs("data", kws)  # change to data-specific kwargs
                    plot_data_ax(fig, ax, self.dataset.matrix_fac, self.dataset.times, self.dataset.wavelengths, **kws)
                case "residuals":
                    kws.update(dict(title=f"Residuals [{self.dataset.name}]", log=False, mu=mu))
                    update_kwargs("residuals", kws)  # change to data-specific kwargs
                    plot_data_ax(fig, ax, self.matrix_opt - self.dataset.matrix_fac, self.dataset.times, self.dataset.wavelengths, **kws)
                case "fit":
                    kws.update(dict(title=f"Fit [{self.dataset.name}]", log=False, mu=mu))
                    update_kwargs("fit", kws)  # change to data-specific kwargs
                    plot_data_ax(fig, ax, self.matrix_opt, self.dataset.times, self.dataset.wavelengths, **kws)
                case "traces":
                    kws.update(dict(title=f"Traces", mu=mu, colors=COLORS))
                    update_kwargs("traces", kws)  # change to data-specific kwargs
                    plot_traces_onefig_ax(ax, self.dataset.matrix_fac, self.matrix_opt, self.dataset.times, self.dataset.wavelengths, **kws)
                case "trapz":

                    y = np.trapz(self.dataset.matrix_fac, self.dataset.wavelengths, axis=1)
                    ax.set_xscale('log')
                    ax.set_yscale('log')
                    ax.set_xlim(2.5, self.dataset.times[-1])
                    ax.set_xlabel(f'Time / {t_unit}')
                    ax.set_ylabel('Integrated intensity')
                    ax.plot(self.dataset.times, y)

                case "eas":
                    kws.update(dict(title="EAS", colors=COLORS, labels=[f"{1 / rate:.3g} {t_unit}" for rate in self.get_rates()]))
                    update_kwargs("eas", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, self.ST_EAS.T, **kws)
                case "eas-norm":
                    kws.update(dict(title="EAS-norm", colors=COLORS, labels=[f"{1 / rate:.3g} {t_unit}" for rate in self.get_rates()]))
                    update_kwargs("eas-norm", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, (self.ST_EAS / self.ST_EAS.max(axis=1, keepdims=True)).T, **kws)
                case "das":
                    # TODO include artifacts
                    kws.update(dict(title="DAS", colors=COLORS, labels=[f"{1 / rate:.3g} {t_unit}" for rate in self.get_rates()]))
                    update_kwargs("das", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, self.ST_opt.T, **kws)
                case "das-norm":
                    kws.update(dict(title="DAS-norm", colors=COLORS, labels=[f"{1 / rate:.3g} {t_unit}" for rate in self.get_rates()]))
                    update_kwargs("das-norm", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, (self.ST_opt / self.ST_opt.max(axis=1, keepdims=True)).T, **kws)
                case "ldm":
                    kws.update(dict(title=f"LDM [{self.dataset.name}]", plot_tilts=False, y_major_formatter=None, cmap='diverging',
                                     z_unit="Amplitude", y_label='Lifetime', mu=None, log_z=False))
                    update_kwargs("ldm", kws)  # change to specific kwargs
                    kws.update(dict(plot_chirp_corrected=False, symlog=False, log=True))
                    plot_data_ax(fig, ax, self.LDM, self.LDM_lifetimes, self.dataset.wavelengths, **kws)
                case "ldmfit":
                    kws.update(dict(title=f"LDM-fit", log=False, mu=mu))
                    update_kwargs("ldmfit", kws)  # change to data-specific kwargs
                    plot_data_ax(fig, ax, self.LDM_fit, self.dataset.times, self.dataset.wavelengths, **kws)
                case "ldmresiduals":
                    kws.update(dict(title=f"LDM-residuals", log=False, mu=mu))
                    update_kwargs("ldmresiduals", kws)  # change to data-specific kwargs
                    plot_data_ax(fig, ax, self.LDM_fit - self.dataset.matrix_fac, self.dataset.times, self.dataset.wavelengths, **kws)
                case "empty":
                    ax.set_axis_off()
                    continue

                case _:
                    raise ValueError(f"Plot {p} is not defined.")
                
        plt.tight_layout()
                
        for ax in axes.flat[n:]:
            ax.set_axis_off()

        filepath = kwargs.get('filepath', None)

        if filepath:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, transparent=kwargs.get('transparent', True), dpi=kwargs.get('dpi', 300))
        else:
            plt.show()



class FirstOrderLPLModel(FirstOrderModel):

    name = "First order kinetic model with optional LPL profile"

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1):
        self.include_LPL = True
        super(FirstOrderLPLModel, self).__init__(dataset, n_species)
        self._calculate_EAS = False

    def init_params(self) -> Parameters:
        params = super(FirstOrderLPLModel, self).init_params()

        if self.include_LPL:
            params.add('LPL_slope', value=1, min=0.1, max=10, vary=True)

        return params
        
    def calculate_C_profiles(self, params: Parameters | None = None):
        super(FirstOrderLPLModel, self).calculate_C_profiles(params)

        if not self.include_LPL:
            return
        
        params = self.params if params is None else params

        m = params['LPL_slope'].value
        trace = LPL_decay(self.dataset.times - params['t0'].value, m)
        self.C_opt = np.hstack((self.C_opt, trace[:, None]))


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
