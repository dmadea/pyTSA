from __future__ import annotations
import os
# from matplotlib.ticker import AutoLocator, MultipleLocator, ScalarFormatter

# from functools import partial

from matplotlib.ticker import AutoMinorLocator
import matplotlib.gridspec as gridspec
import numpy as np
# from scipy.integrate import odeint
from lmfit import Parameters, Minimizer, conf_interval, conf_interval2d, report_ci
from lmfit.minimizer import MinimizerResult
from typing import TYPE_CHECKING, Callable

from abc import abstractmethod

# from .fit import Fitter
# from numba import njit

from .mathfuncs import LPL_decay, blstsq, fi, fit_polynomial_coefs, fit_sum_exp, fold_exp, gaussian, get_EAS_transform, glstsq, lstsq, simulate_target_model, square_conv_exp
from .plot import MinorSymLogLocator, plot_SADS_ax, plot_data_ax, plot_fitresiduals_axes, plot_spectra_ax, plot_time_traces_onefig_ax, plot_traces_onefig_ax, set_main_axis
if TYPE_CHECKING:
    from .dataset import Dataset

import matplotlib.pyplot as plt
import matplotlib.colors as mplcols
from matplotlib import cm

# from targetmodel import TargetModel
# import glob, os
import scipy.constants as sc
from copy import deepcopy

def save_matrix(dim0: np.iterable, dim1: np.iterable, matrix: np.ndarray, fname='output.txt', delimiter='\t', encoding='utf8', transpose=False):
    mat = np.vstack((dim0, matrix.T)) if transpose else np.vstack((dim1, matrix))
    buffer = delimiter + delimiter.join(f"{num}" for num in (dim1 if transpose else dim0)) + '\n'
    buffer += '\n'.join(delimiter.join(f"{num}" for num in row) for row in mat.T)

    with open(fname, 'w', encoding=encoding) as f:
        f.write(buffer)



# from scipy.linalg import lstsq

# abstract class that every model must inherits

# kinetic model class for models which can be solved by variable projection method, 
# all concentration profiles are parametrized by a model and spectra are linearly dependent parameters
class KineticModel(object):
    """
    Abstract class for kinetic models.

    Attributes
    ----------
    dataset : Dataset | None
        Dataset bound with this model.

    n_species: int
        Number of species.
    
    params: Parameters
        Lmfit parameters of the model.

    C_opt: np.ndarray | None
        Optimized concentration profiles after fitting of the model.

    ST_opt: np.ndarray | None
        Optimized spectra after fitting of the model.      

    matrix_opt: np.ndarray | None
        Fit matrix.

    minimizer: Minimizer | None
        Lmfit minimizer used to fit the model.

    fit_result: MinimizerResult | None
        Lmfit minimizer result after fitting of the model.

    fitter_kwds: dict
        Keyword argments passed to the underlying fitting algorithm.

    fit_algorithm : str
        Fitting algorithm, default least_squares for Trust region reflective algorithm.

    noise_range: None | tuple[float, float]
        If not None, it is a range of wavelengths as tuple and it will be used to calculate the standard deviation in this range.
        These stds will be used to for weighted regression and the weights will be set as 1/std for each time point (both in least squared procedure and 
        for calculation of residuals).

    Methods
    -------
    fit(c='rgb')
        Represent the photo in the given colorspace.

    """
    name = '___abstract Kinetic Model____'
    # description = "..."
    # _class = '-class-'

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1, set_model: bool = False):
    
        self.dataset: Dataset = dataset
        if set_model:
            self.dataset.model = self
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

        # if set, the std will be calculated for each time point in this range and used for weighting of each spectrum, only works for weight_type == 'prop_tresh'
        self.noise_floor_estimation_from_data: bool = False
        self.noise_range: tuple[float, float] = []   # wavelengths range from which the noise will be taken

        # prop = proportional weighting with noise floor, w_ij = 1 / (k * abs(D_ij) ** Exp + noisefloor_i)
        # log = logarithmic weighting of the data, w_ij = abs(D_ij) > log_tresh ? 1 / ln(abs(D_ij)) : 0
        self.weight_types = ['no_weighting', 'prop_thresh', 'prop_noise_floor']  
        self.weight_type: str | None = None
        self.calc_weights_from_fit_matrix = True

        # Individual weighting parameters (previously in weighting_params dictionary)
        self.weighting_k: float = 0.000
        self.weighting_noise_floor: float | np.ndarray = 0.005
        self.weighting_exponent: float = 1
        self.weighting_thresh: float = 1e-5

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

    def weighted_residuals(self) -> np.ndarray:
        if (self.matrix_opt is None):
            raise TypeError("Optimized matrix is None")
        R = self.dataset.matrix_fac - self.matrix_opt
        weights = self.get_weights()
        return R * np.sqrt(weights)

    def get_weights_lstsq(self):
        w = np.sqrt(self.get_weights())
        return w.sum(axis=1)

    def _calculate_noise_floor(self):
        if not self.noise_floor_estimation_from_data:
            return

        assert len(self.noise_range) == 2
        i, j = fi(self.dataset.wavelengths, self.noise_range)

        stds = np.std(self.dataset.matrix_fac[:, i:j+1], axis=1, keepdims=True)
        self.weighting_noise_floor = stds
        

    def get_weights(self):
        weights = np.ones_like(self.dataset.matrix_fac)

        if self.weight_type == 'no_weighting':
            return weights

        if self.calc_weights_from_fit_matrix:
            mat = self.dataset.matrix_fac if self.matrix_opt is None else self.matrix_opt
        else:
            mat = self.dataset.matrix_fac

        mat = np.abs(mat)

        # https://gregorygundersen.com/blog/2022/08/09/weighted-ols/
        if self.weight_type == self.weight_types[2]:  # prop_noise_floor
            self._calculate_noise_floor()
            
            noise_floor = self.weighting_noise_floor
            exponent = self.weighting_exponent
            k = self.weighting_k

            variance = (k * (mat ** exponent)) ** 2 + noise_floor ** 2

            # weights *= 1 / (k * (mat ** exponent) + noise_floor)
            weights *= 1 / variance


        elif self.weight_type == self.weight_types[1]:  # prop_thresh

            tresh = self.weighting_thresh

            weights *= np.where(mat > tresh, 1 / mat, 0)

        for *rng, w in self._weights:
            i, j = fi(self.dataset.wavelengths, rng)    
            weights[:, i:j+1] *= w

        return weights

    def get_residuals_histogram(self, wr: np.ndarray | None = None, n = 2, rng_quantile=1e-3) -> tuple[np.ndarray, np.ndarray]:
        wr = self.weighted_residuals() if wr is None else wr

        rng = np.quantile(wr, [rng_quantile, 1 - rng_quantile], )  # to remove the outliers

        hist, edge = np.histogram(wr, int(n * np.sqrt(wr.shape[0] * wr.shape[1])), range=rng, density=True)
        x = edge[1:] - edge[1] + edge[0]

        return x, hist


    def estimate_prop_weighting_params(self, use_fit_matrix=True, fix_noise_floor=False) -> MinimizerResult:

        pars = Parameters()
        noise_floor = self.weighting_noise_floor
        noise_floor = 0 if np.iterable(noise_floor) else noise_floor

        pars.add('noise_floor', value=noise_floor, min=0, max=np.inf, vary=False if fix_noise_floor else not self.noise_floor_estimation_from_data)
        pars.add('k', value=self.weighting_k, min=0, max=2, vary=True)
        pars.add('exponent', value=self.weighting_exponent, min=0.1, max=2, vary=True)

        def residuals(params):
            k = params['k'].value
            exponent = params['exponent'].value

            n_floor_std = self.weighting_noise_floor if self.noise_floor_estimation_from_data else params['noise_floor'].value
            mat = self.matrix_opt if use_fit_matrix else self.dataset.matrix_fac
            mat = np.abs(mat)

            # calculate weighted residuals
            wr = (self.dataset.matrix_fac - self.matrix_opt) / (k * mat ** exponent + n_floor_std)

            x, hist = self.get_residuals_histogram(wr)

            gauss = np.exp(-x * x / 2) / np.sqrt(2 * np.pi)
            # amp = (gauss * hist).sum() / (gauss * gauss).sum()  # from d/da sum(a * xi - yi)^2 = 0, a = sum(xi*yi) / sum(xi^2)
            return gauss - hist

        minimizer = Minimizer(residuals, pars, nan_policy='raise')
        # fitter_kwds = dict(ftol=1e-10, xtol=1e-10, gtol=1e-10, loss='soft_l1', verbose=2, jac='3-point')
        fitter_kwds = dict()
        fit_result = minimizer.minimize(method='nelder_mead', **fitter_kwds)  # minimize the 
        
        if not self.noise_floor_estimation_from_data:
            self.weighting_noise_floor = fit_result.params['noise_floor'].value
        
        self.weighting_k = fit_result.params['k'].value
        self.weighting_exponent = fit_result.params['exponent'].value
        
        return fit_result

    
    def confidence_intervals(self, p_names=None, sigmas=(1, 2, 3)):
        """Prints a confidence intervals.

        Parameters
        ----------
        p_names : {list, None}, optional
            Names of the parameters for which the confidence intervals are calculated. If None (default),
            the confidence intervals are calculated for every parameter.
        sigmas : {list, tuple}, optional
            The sigma-levels to find (default is [1, 2, 3]). See Note below.

        Note
        ----
        The values for sigma are taken as the number of standard deviations for a normal distribution
        and converted to probabilities. That is, the default sigma=[1, 2, 3] will use probabilities of
        0.6827, 0.9545, and 0.9973. If any of the sigma values is less than 1, that will be interpreted
        as a probability. That is, a value of 1 and 0.6827 will give the same results, within precision.

        """
        ci = conf_interval(self.minimizer, self.fit_result, p_names=p_names, sigmas=sigmas)
        report_ci(ci)

    def corner_plot(self, n_points: int = 10, sigmas_mul_factor: float = 1.5, colorbar_n_levels=11, plot_countours = True,
                     X_SIZE=4, Y_SIZE=3, figsize=None, cmap='hot', filepath=None, **kwargs):
        
        keys = list(filter(lambda key: self.fit_result.params[key].vary, self.fit_result.params.keys()))
        # print(keys)
        n_params = len(keys)

        if n_params < 2:
            return

        fig, axes = plt.subplots(n_params - 1, n_params - 1, 
                                 figsize=(X_SIZE * (n_params - 1), Y_SIZE * (n_params - 1) if figsize is None else figsize))
        
        if n_params == 2:
            axes = np.asarray([[axes]])
        
        for i in range(n_params - 1):
            for j in range(n_params - 1):
                ax = axes[i, j]
                if j > i:
                    ax.set_axis_off()
                    continue

                xname = keys[j]
                yname = keys[i+1]
                xpar = self.fit_result.params[xname]
                ypar = self.fit_result.params[yname]

                limits = ((xpar.value + xpar.stderr * sigmas_mul_factor, xpar.value - xpar.stderr * sigmas_mul_factor),
                   (ypar.value + ypar.stderr * sigmas_mul_factor, ypar.value - ypar.stderr * sigmas_mul_factor))
                
                cx, cy, grid = conf_interval2d(self.minimizer, self.fit_result, xname, yname, n_points, n_points, limits=limits)

                # plot the data
                levels = np.linspace(0, 1, colorbar_n_levels)

                set_main_axis(ax, x_minor_locator=AutoMinorLocator(2), y_minor_locator=AutoMinorLocator(2))
                ax.set_xlabel(xname, weight='bold')
                ax.set_ylabel(yname, weight='bold')

                norm = mplcols.Normalize(vmin=0,vmax=1, clip=True)
                mappable = ax.contourf(cx, cy, grid, cmap=cmap, norm=norm, levels=levels, antialiased=True)

                if plot_countours:
                    cmap_colors = cm.get_cmap(cmap)
                    colors = cmap_colors(np.linspace(0, 1, colorbar_n_levels + 1))
                    colors *= 0.45  # plot contours as darkens colors of colormap, blue -> darkblue, white -> gray ...
                    ax.contour(cx, cy, grid, colors=colors, levels=levels, antialiased=True, linewidths=0.1,
                            alpha=1, linestyles='-')

                ax.tick_params(which='major', direction='out')
                ax.tick_params(which='minor', direction='out')
                ax.yaxis.set_ticks_position('both')

                # ax.set_axisbelow(False)

                if i < n_params - 2:
                    ax.xaxis.set_ticklabels([])
                    # ax.set_xticks([])
                    ax.set_xlabel('')
                if j > 0:
                    ax.yaxis.set_ticklabels([])
                    # ax.set_yticks([])
                    ax.set_ylabel('')
                

                fig.colorbar(mappable, ax=ax, label="", orientation='vertical')

        plt.tight_layout()

        if filepath is not None:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, bbox_inches='tight', 
                        transparent=kwargs.get('transparent', True), 
                        dpi=kwargs.get('dpi', 300))
        else:
            plt.show()



    # https://lmfit.github.io/lmfit-py/confidence.html
    def confidence_interval2D(self, x_name: str, y_name: str, nx: int = 10, ny: int = 10, sigmas_mul_factor: float = 1.0):
        """Draws a 2D confidence intervals using matplotlib.

        Parameters
        ----------
        x_name : str
            Name of the variable that will be on the x axis.
        y_name : str
            Name of the variable that will be on the y axis.
        nx : int, optional
            Number of points in the x direction, default 10, the higher the value, better resolution, but slower.
        ny : int, optional
            Number of points in the y direction, default 10, the higher the value, better resolution, but slower.
        limits : tuple, optional
            Should have the form ``((x_upper, x_lower), (y_upper, y_lower))``.
            If not given, the default is nsigma*stderr in each direction.
        """

        xpar = self.fit_result.params[x_name]
        ypar = self.fit_result.params[y_name]

        limits = ((xpar.value + xpar.stderr * sigmas_mul_factor, xpar.value - xpar.stderr * sigmas_mul_factor),
                   (ypar.value + ypar.stderr * sigmas_mul_factor, ypar.value - ypar.stderr * sigmas_mul_factor))

        cx, cy, grid = conf_interval2d(self.minimizer, self.fit_result, x_name, y_name, nx, ny, limits=limits)
        plt.contourf(cx, cy, grid, np.linspace(0, 1, 21))
        plt.xlabel(x_name)
        plt.colorbar()
        plt.ylabel(y_name)
        plt.show()

    def copy(self) -> KineticModel:
        c = deepcopy(self)
        c.dataset = None
        return c


class FirstOrderModel(KineticModel):
    """
    Abstract class for kinetic models.

    Attributes
    ----------
 



    Methods
    -------


    """

    name = "First order kinetic model"

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1, set_model: bool = False):
        # more settings
        self.central_wave = 500  # lambda_c, wavelength at central wave, it is necessary for calculation of chirp parameters
        self.include_chirp: bool = True  # if True, model will be fitted with more complex tensor method
        self.chirp_types = ['poly', 'exp']
        self.chirp_type = self.chirp_types[1]  # poly, exp chirp type
        self.num_of_poly_chirp_params = 5
        self.num_of_exp_chirp_params = 2

        self.include_irf = False   # if True, irf will be used to simulate the exponentials
        self.irf_types = ['Gaussian', 'Square']
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

        self.C_opt_full = None  # used for target model

        self.LDM: np.ndarray | None = None
        self.LDM_fit: np.ndarray | None = None
        self.LDM_lifetimes: np.ndarray | None = None

        # self.weight_chirp = False
        # self.w_of_chirp = 0.1
        # self.t_radius_chirp = 0.2  # time radius around chirp / in ps
        self._calculate_EAS = True
        self._include_rates_params = True

        super(FirstOrderModel, self).__init__(dataset, n_species, set_model)

        # self.update_n()
        # self.ridge_alpha = 0.0001

        # self.C_COH = None
        # self.ST_COH = None
    
    # TODO update labels for target models,  exporting of full fit matrix command 

    def export_DAS(self, fname='output.txt', delimiter='\t', encoding='utf8'):
        names = [f'DAS {i+1}' for i in range(self.ST_opt.shape[0])]
        save_matrix(names, self.dataset.wavelengths, self.ST_opt, fname=fname, delimiter=delimiter, encoding=encoding, transpose=False)

    def export_EAS(self, fname='output.txt', delimiter='\t', encoding='utf8'):
        assert self.ST_EAS is not None
        names = [f'EAS {i+1}' for i in range(self.ST_EAS.shape[0])]
        save_matrix(names, self.dataset.wavelengths, self.ST_EAS, fname=fname, delimiter=delimiter, encoding=encoding, transpose=False)

    def export_DAS_Cprofiles(self, fname='output.txt', delimiter='\t', encoding='utf8'):
        names = [f'DAS profile {i+1}' for i in range(self.ST_opt.shape[0])]
        save_matrix(self.dataset.times, names, self.C_opt, fname=fname, delimiter=delimiter, encoding=encoding, transpose=True)

    def export_EAS_Cprofiles(self, fname='output.txt', delimiter='\t', encoding='utf8'):
        assert self.C_EAS is not None
        names = [f'EAS profile {i+1}' for i in range(self.ST_opt.shape[0])]
        save_matrix(self.dataset.times, names, self.C_EAS, fname=fname, delimiter=delimiter, encoding=encoding, transpose=True)


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

            elif self.irf_type == self.irf_types[1]: # square wave
                params.add('SQW', value=0.15, min=0, max=np.inf, vary=True)  # width of the square wave


        if self._include_rates_params:
            for i in range(self.n_species):
                params.add(f'tau_{i+1}', value=10 ** (i - 1), min=0, max=np.inf, vary=True)

        return params
    
    def get_irf_width(self, params: Parameters | None = None):
        params = self.params if params is None else params

        if not self.include_irf:
            return 0
        
        if self.irf_type == self.irf_types[0]:
            return params['FWHM'].value
        elif self.irf_type == self.irf_types[1]:
            return params['SQW'].value 
    
    def get_rates(self, params: Parameters | None = None) -> np.ndarray:
        if (self.n_species == 0 or not self._include_rates_params):
            return np.asarray([])
        
        params = self.params if params is None else params

        vals = np.asarray([params[f"tau_{i+1}"].value for i in range(self.n_species)])
        return 1 / vals
    
    def get_labels(self, t_unit='ps') -> list[str]:

        if t_unit == 'ps':
            t_unit1e3 = 'ns'
            t_unit1e6 = '$\\mu$s'
        elif t_unit == 'ns':
            t_unit1e3 = '$\\mu$s'
            t_unit1e6 = 'ms'
        elif t_unit == '$\\mu$s':
            t_unit1e3 = 'ms'
            t_unit1e6 = 's'
        elif t_unit == 'ms':
            t_unit1e3 = 's'
            t_unit1e6 = 'ks'
        elif t_unit == 's':
            t_unit1e3 = 'ks'
            t_unit1e6 = 'Ms'

        labels = []
        irf = self.get_irf_width()
        for rate in self.get_rates():
            l = 1/rate

            if l <= irf:
                labels.append(f"$\\leq${irf:.2g} {t_unit} (IRF)")
                continue

            if l >= 1e6:
                l *= 1e-6
                labels.append(f"{l:.3g} {t_unit1e6}")
            elif l >= 1000:
                l *= 1e-3
                labels.append(f"{l:.3g} {t_unit1e3}")
            else:
                labels.append(f"{l:.3g} {t_unit}")
            
        return labels
    
    def get_width(self, params: Parameters | None = None) -> float:
        params = self.params if params is None else params

        if not self.include_irf:
            return 0
        
        if self.irf_type == self.irf_types[0]:
            return params["FWHM"].value
        elif self.irf_type == self.irf_types[1]:
            return params["SQW"].value

    def get_tau(self, params: Parameters | None = None) -> np.ndarray | float:
        """Return the curve that defines FWHM with respect to wavelength."""

        params = self.params if params is None else params
        
        width = self.get_width(params)
        if width == 0 or self.irf_type != self.irf_types[0]:
            return width
        
        if not self.include_variable_fwhm:
            return width
        
        tau = np.ones(self.dataset.wavelengths.shape[0], dtype=np.float64) * width

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
    
    def get_actual_chirp_data(self) -> np.ndarray:
        """Returns the actual curve that describes the chirp, 
        if chirp is not included, it will return array filled with parameter t0"""

        mu = self.get_mu()
        if isinstance(mu, (float, int)):
            mu = np.ones(self.dataset.wavelengths.shape[0], dtype=np.float64) * mu
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

    def get_C_profiles_args(self, params: Parameters | None = None, times: np.ndarray | None = None):
        params = self.params if params is None else params
        self.C_opt = None
        self.C_artifacts = None

        ks = self.get_rates(params)
        mu = self.get_mu(params)
        width = self.get_tau(params)  # fwhm

        # if True, partitioned variable projection will be used for fitting
        tensor: bool = isinstance(mu, np.ndarray) or isinstance(width, np.ndarray)

        _tau = width[:, None, None] if isinstance(width, np.ndarray) else width
        _mu = mu[:, None, None] if isinstance(mu, np.ndarray) else mu
        times = self.dataset.times if times is None else times
        _t = times[None, :, None] if tensor else times[:, None]
        tt = _t - _mu

        _ks = ks[None, None, :] if tensor else ks[None, :]

        if self.include_artifacts:
            self.C_artifacts = self._simulate_artifacts(tt, width)

        return tt, _ks, _tau

    def get_exp_function(self) -> Callable[[np.ndarray | float, np.ndarray | float, np.ndarray | float], np.ndarray | float]:
        return fold_exp if self.irf_type == self.irf_types[0] else square_conv_exp

        
    def calculate_C_profiles(self, params: Parameters | None = None, times: np.ndarray | None = None):
        """Simulates concentration profiles, including coherent artifacts if setup in a model.
        
        if times arg is not None, these values will be used to simulate C profiles from
        
        """

        tt, _ks, _tau = self.get_C_profiles_args(params, times)

        if self.n_species == 0:
            return
        
        # simulation for DADS only
        f = self.get_exp_function()
        self.C_opt: np.ndarray = f(tt, _ks, _tau)


    def fit(self):
        def residuals(params):
            self.simulate(params)
            return self.weighted_residuals()

        # iter_cb - callback function
        self.minimizer = Minimizer(residuals, self.params, nan_policy='omit') #,
                                        #  iter_cb=lambda params, iter, resid, *args, **kws: self.is_interruption_requested())
        
        self.fit_result = self.minimizer.minimize(method=self.fit_algorithm, **self.fitter_kwds)  # minimize the residuals
        self.params = self.fit_result.params

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
        
        # fig, axes = plt.subplots(nrows, ncols, figsize=kwargs.get('figsize', (X_SIZE * ncols, Y_SIZE * nrows)))
        fig = plt.figure(figsize=kwargs.get('figsize', (X_SIZE * ncols, Y_SIZE * nrows)))

        outer_grid = gridspec.GridSpec(1, 1, figure=fig)

        self._plot_gs(fig, outer_grid[0], what, nrows, ncols, hspace=hspace, wspace=wspace, add_figure_labels=add_figure_labels,
                      figure_labels_font_size=figure_labels_font_size, fig_labels_offset=fig_labels_offset, **kwargs)

        if filepath:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, bbox_inches='tight', transparent=transparent, dpi=dpi)
        else:
            plt.show()

    def _plot_gs(self, fig: plt.Figure, grid_spec: gridspec.GridSpec | gridspec.GridSpecFromSubplotSpec, what: tuple[str], 
                 nrows: int, ncols: int, hspace=0.2, wspace=0.2, add_figure_labels=False, figure_labels_font_size=17, 
                 fig_labels_offset=0, **kwargs):
        
        # what is list of figures to plot
        # data, traces, EADS, DADS, LDM, residuals

        # outer_grid = gridspec.GridSpec(nrows, ncols, wspace=wspace, hspace=hspace)
        inner_grid = gridspec.GridSpecFromSubplotSpec(nrows, ncols, wspace=wspace, hspace=hspace, subplot_spec=grid_spec)

        mu = self.get_mu()
        COLORS = ['blue', 'red', 'green', 'orange', 'purple', 'black', 'gray']
        t_unit=kwargs.get('t_unit', 'ps')

        def update_kwargs(prefix: str, kwargs: dict):
            for key, value in kwargs.copy().items():
                if key.startswith(prefix.lower()):
                    _key = key[len(prefix) + 1:]  # to account for _ symbol
                    kwargs[_key] = value
        f_labels = list('abcdefghijklmnopqrstuvw')

        for i, (p, ig) in enumerate(zip(what, inner_grid)):
            if i >= nrows * ncols:
                break

            if p.lower() == 'fitresiduals':
                ii_grid = gridspec.GridSpecFromSubplotSpec(2, 1, subplot_spec=ig, wspace=0.1, hspace=0.1,
                                                      height_ratios=(3, 1))
                ax = fig.add_subplot(ii_grid[0])  # ax_data, ax is necessary for potential figure label
                ax_res = fig.add_subplot(ii_grid[1])
            else:
                ax = fig.add_subplot(ig)
            
            kws = kwargs.copy()
            match p.lower():
                case "fitresiduals":
                    update_kwargs("fitresiduals", kws)  # change to data-specific kwargs
                    single_dim = self.dataset.matrix_fac.shape[1] == 1
                    mat = self.dataset.matrix_fac[:, 0] if single_dim else self.dataset.matrix_fac.sum(axis=1)
                    opt = self.matrix_opt[:, 0] if single_dim else self.matrix_opt.sum(axis=1)
                    res = self.weighted_residuals()[:, 0] if single_dim else self.weighted_residuals().sum(axis=1)

                    plot_fitresiduals_axes(ax, ax_res, self.dataset.times, mat, opt, res, title=self.dataset.name, mu=mu, **kws)

                case "data":
                    kws.update(dict(title=f"Data [{self.dataset.name}]", log=False, mu=mu))
                    update_kwargs("data", kws)  # change to data-specific kwargs
                    plot_data_ax(fig, ax, self.dataset.matrix_fac, self.dataset.times, self.dataset.wavelengths, **kws)
                case "residuals":
                    kws.update(dict(title=f"Residuals [{self.dataset.name}]", log=False, mu=mu))
                    update_kwargs("residuals", kws)  # change to data-specific kwargs
                    plot_data_ax(fig, ax, self.weighted_residuals(), self.dataset.times, self.dataset.wavelengths, **kws)
                case "weights":
                    kws.update(dict(title=f"Weights [{self.dataset.name}]", log=False, mu=mu), z_unit='Weight')
                    update_kwargs("weights", kws)  # change to data-specific kwargs

                    single_dim = self.dataset.matrix_fac.shape[1] == 1

                    if single_dim:
                        plot_time_traces_onefig_ax(ax, self.get_weights(), self.dataset.times, **kws)
                    else:
                        plot_data_ax(fig, ax, self.get_weights(), self.dataset.times, self.dataset.wavelengths, **kws)
                case "fit":
                    kws.update(dict(title=f"Fit [{self.dataset.name}]", log=False, mu=mu))
                    update_kwargs("fit", kws)  # change to data-specific kwargs
                    plot_data_ax(fig, ax, self.matrix_opt, self.dataset.times, self.dataset.wavelengths, **kws)
                case "traces":
                    kws.update(dict(title=f"Traces", mu=mu, colors=COLORS))
                    update_kwargs("traces", kws)  # change to data-specific kwargs
                    plot_traces_onefig_ax(ax, self.dataset.matrix_fac, self.matrix_opt, self.dataset.times, self.dataset.wavelengths, **kws)
                case "cprofiles":
                    kws.update(dict(title=f"C-profiles", colors=COLORS, mu=mu, labels=self.get_labels(t_unit)), z_unit='Population')
                    update_kwargs("cprofiles", kws)  # change to data-specific kwargs

                    if self.C_opt.ndim == 3:
                        _C = self.C_opt_full[0] if self.C_opt_full is not None else self.C_opt[0]
                    else:
                        _C = self.C_opt_full if self.C_opt_full is not None else self.C_opt

                    plot_time_traces_onefig_ax(ax, _C, self.dataset.times, **kws)
                case "trapz":

                    y = np.trapezoid(self.dataset.matrix_fac, self.dataset.wavelengths, axis=1)
                    ax.set_xscale('log')
                    ax.set_yscale('log')
                    ax.set_xlim(2.5, self.dataset.times[-1])
                    ax.set_xlabel(f'Time / {t_unit}')
                    ax.set_ylabel('Integrated intensity')
                    ax.plot(self.dataset.times, y)

                case "residuals_histogram":
                    x, hist = self.get_residuals_histogram()
                    gauss = np.exp(-x * x / 2) / np.sqrt(2 * np.pi)
                    ax.scatter(x, hist, edgecolor='red', facecolor='white', lw=1.5)
                    ax.plot(x, gauss, color='k', ls='--')  #, label='norm. dist. $\\sigma = 1$')
                    # ax.legend(frameon=False)

                case "eas":
                    kws.update(dict(title="EAS", colors=COLORS, labels=self.get_labels(t_unit)))
                    update_kwargs("eas", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, self.ST_EAS.T, Artifacts=self.ST_artifacts.T if self.ST_artifacts is not None else None, **kws)
                case "eas-norm":
                    kws.update(dict(title="EAS-norm", colors=COLORS, labels=self.get_labels(t_unit)))
                    update_kwargs("eas-norm", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, (self.ST_EAS / self.ST_EAS.max(axis=1, keepdims=True)).T, **kws)
                case "das":
                    kws.update(dict(title="DAS", colors=COLORS, labels=self.get_labels(t_unit)))
                    update_kwargs("das", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, self.ST_opt.T, Artifacts=self.ST_artifacts.T if self.ST_artifacts is not None else None, **kws)
                case "das-norm":
                    kws.update(dict(title="DAS-norm", colors=COLORS, labels=self.get_labels(t_unit)))
                    update_kwargs("das-norm", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, (self.ST_opt / self.ST_opt.max(axis=1, keepdims=True)).T, **kws)

                case "spectra":
                    kws.update(dict(title="", mu=mu))
                    update_kwargs("spectra", kws)  # change to data-specific kwargs
                    plot_spectra_ax(ax, self.dataset.matrix_fac, self.dataset.times, self.dataset.wavelengths, **kws)
                case "ldm":
                    kws.update(dict(title=f"LDM [{self.dataset.name}]", plot_tilts=False, y_major_formatter=None, cmap='diverging_uniform',
                                     z_unit="Amplitude", y_label='Lifetime', mu=None, log_z=False))
                    update_kwargs("ldm", kws)  # change to specific kwargs
                    kws.update(dict(plot_chirp_corrected=False, symlog=False, log=True, t_lim=(None, None)))
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


            if add_figure_labels:
                ax.text(-0.05, 1.05, f_labels[i + fig_labels_offset], color='black', transform=ax.transAxes,
                        fontstyle='normal', fontweight='bold', fontsize=figure_labels_font_size)        
        # plt.tight_layout()

        # for ax in axes.flat[:n]:
        #     if add_figure_labels:
        #         ax.text(-0.1, 1.10, f_labels[i + fig_labels_offset], color='black', transform=ax.transAxes,
        #                 fontstyle='normal', fontweight='bold', fontsize=figure_labels_font_size)
                
        # for ax in axes.flat[n:]:
        #     ax.set_axis_off()


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

    def target_params(self, params: Parameters | None = None) -> tuple[np.ndarray, np.ndarray]:
        """Return a tuple with the first argument as initial j vector and second argument is K matrix"""
        raise NotImplementedError()
    
    def get_labels(self, t_unit='ps'):
        raise NotImplementedError()

    def calculate_C_profiles(self, params: Parameters | None = None, times: np.ndarray | None = None):
        params = self.params if params is None else params
        tt, _ks, _tau = self.get_C_profiles_args(params, times)

        if self.n_species == 0:
            return
        
        j, K = self.target_params(params)

        f = self.get_exp_function()
        self.C_opt_full = simulate_target_model(tt, K, j, f, _tau)

        if len(self.used_compartments) == 0:
            raise ValueError("At least one compartment has to be assigned to C_opt")
        else:
            self.C_opt = self.C_opt_full[:, self.used_compartments]



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
    
    def target_params(self, params: Parameters | None = None) -> tuple[np.ndarray, np.ndarray]:
        """Return a tuple with the first argument as initial j vector and second argument is K matrix"""
        
        k_sens_0, Kq, k_T = params['k_sens_0'].value, params['Kq'].value, params['k_T'].value

        K = np.asarray([[-k_sens_0 - Kq, 0],
                        [Kq,      -k_T]])
    
        j = np.asarray([1, 0])

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
            labels = np.asarray(['S1', 'T1', 'inf'])
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
        