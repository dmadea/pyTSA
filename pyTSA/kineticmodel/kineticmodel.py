from __future__ import annotations
import os
# from matplotlib.ticker import AutoLocator, MultipleLocator, ScalarFormatter

# from functools import partial

from matplotlib.ticker import AutoMinorLocator, FuncFormatter
import matplotlib.gridspec as gridspec
import numpy as np
from lmfit import Parameters, Minimizer, conf_interval, conf_interval2d, report_ci
from lmfit.minimizer import MinimizerResult
from typing import TYPE_CHECKING, ClassVar, Iterator

from abc import abstractmethod
from enum import Enum, auto

from ..mathfuncs import chirp_correction, fi, fit_polynomial_coefs, fit_sum_exp, gaussian, get_EAS_transform, glstsq, fold_exp_vec, square_conv_exp_vec, exp_dist
from ..plot import plot_SADS_ax, plot_data_ax, plot_fitresiduals_axes, plot_spectra_ax, plot_time_traces_onefig_ax, plot_traces_onefig_ax, set_main_axis, COLORS
if TYPE_CHECKING:
    from ..dataset import Dataset

import matplotlib.pyplot as plt
import matplotlib.colors as mplcols
from matplotlib import cm

# import glob, os
import scipy.constants as sc
from copy import deepcopy
from dataclasses import dataclass, fields


from numpy.linalg import svd


class ChirpType(Enum):
    POLY = auto()
    EXP = auto()


class IrfType(Enum):
    GAUSSIAN = auto()
    SQUARE = auto()


class VariableFwhmType(Enum):
    POLY = auto()


class WeightType(Enum):
    NO_WEIGHTING = auto()
    PROP_THRESH = auto()
    PROP_NOISE_FLOOR = auto()


def _coerce_weight_type(value: WeightType | str | None) -> WeightType | None:
    if value is None or isinstance(value, WeightType):
        return value
    if isinstance(value, str):
        return WeightType[value]
    raise TypeError(f"weight_type must be WeightType, str, or None, got {type(value).__name__}")


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

    weight_types: ClassVar[tuple[WeightType, ...]] = tuple(WeightType)

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

        # if set, the std will be calculated for each time point in this range and used for weighting of each spectrum
        self.noise_floor_estimation_from_data: bool = False
        self.noise_range: tuple[float, float] = []   # wavelengths range from which the noise will be taken

        # PROP_NOISE_FLOOR: w from variance (k * |D|^Exp)^2 + noise_floor^2; PROP_THRESH: w_ij = |D_ij| > thresh ? 1/|D_ij| : 0
        self.weight_type: WeightType | None = None
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
        if "weight_type" in kwargs:
            kwargs = {**kwargs, "weight_type": _coerce_weight_type(kwargs["weight_type"])}
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

        if self.weight_type is WeightType.NO_WEIGHTING:
            return weights

        if self.calc_weights_from_fit_matrix:
            mat = self.dataset.matrix_fac if self.matrix_opt is None else self.matrix_opt
        else:
            mat = self.dataset.matrix_fac

        mat = np.abs(mat)

        # https://gregorygundersen.com/blog/2022/08/09/weighted-ols/
        if self.weight_type is WeightType.PROP_NOISE_FLOOR:
            self._calculate_noise_floor()
            
            noise_floor = self.weighting_noise_floor
            exponent = self.weighting_exponent
            k = self.weighting_k

            variance = (k * (mat ** exponent)) ** 2 + noise_floor ** 2

            # weights *= 1 / (k * (mat ** exponent) + noise_floor)
            weights *= 1 / variance


        elif self.weight_type is WeightType.PROP_THRESH:

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


class BaseKineticModel(KineticModel):
    """
    Abstract class for kinetic models. Handles basic simulation and fitting methods, chirp,
    artifacts simulation and handling. Does not add any kinetic rates.

    Attributes
    ----------

    Methods
    -------

    """

    name = "Base kinetic model"

    # chirp_types: ClassVar[tuple[ChirpType, ...]] = tuple(ChirpType)
    # irf_types: ClassVar[tuple[IrfType, ...]] = tuple(IrfType)

    @property
    def chirp_type(self) -> ChirpType:
        return self._chirp_type

    @chirp_type.setter
    def chirp_type(self, value: ChirpType | str):
        if isinstance(value, str):
            value = ChirpType[value.upper()]
        elif not isinstance(value, ChirpType):
            raise TypeError(f"chirp_type must be ChirpType, str, got {type(value).__name__}")

        self._chirp_type = value

    @property
    def irf_type(self) -> IrfType:
        return self._irf_type

    @irf_type.setter
    def irf_type(self, value: IrfType | str):
        if isinstance(value, str):
            value = IrfType[value.upper()]
        elif not isinstance(value, IrfType):
            raise TypeError(f"irf_type must be IrfType, str, got {type(value).__name__}")

        self._irf_type = value


    @property
    def variable_fwhm_type(self) -> VariableFwhmType:
        return self._variable_fwhm_type

    @variable_fwhm_type.setter
    def variable_fwhm_type(self, value: VariableFwhmType | str):
        if isinstance(value, str):
            value = VariableFwhmType[value.upper()]
        elif not isinstance(value, VariableFwhmType):
            raise TypeError(f"variable_fwhm_type must be VariableFwhmType, str, got {type(value).__name__}")

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1, set_model: bool = False):

        # Default chirp-related settings
        self.central_wave: float = 500
        self.include_chirp: bool = True
        self._chirp_type: ChirpType = ChirpType.EXP
        self.num_of_poly_chirp_params: int = 5
        self.num_of_exp_chirp_params: int = 2

        # Default IRF / variable-FWHM settings

        self.include_irf: bool = False
        self._irf_type: IrfType = IrfType.GAUSSIAN
        self.n_irfs: int = 1
        self.include_variable_fwhm: bool = False
        self._variable_fwhm_type: VariableFwhmType = VariableFwhmType.POLY
        self.num_of_poly_varfwhm_params: int = 3

        # Default coherent-artifact settings

        self.include_artifacts: bool = False
        self.artifact_order: int = 0

        # Default DOAS settings

        self.n_DOAS: int = 0

        self.zero_coh_spec_range = []  # zero coherent artifact in that wavelength range

        self.ridge_alpha = 0.0001

        # concentration profiles and spectra of coherent artifacts
        self.C_artifacts: np.ndarray | None = None
        self.ST_artifacts: np.ndarray | None = None

        self.ST_DOAS: np.ndarray | None = None  # contains full reconstructed DOAS
        self.DOAS_phases = None  # phases of the DOAS components
        self._C_DOAS: np.ndarray | None = None  # contains individual sin and cos compoenents
        
        # for C_opt and ST_opt, decay profiles and DAS will be plotted
        # for EAS, new variables are defined
        self.C_EAS: np.ndarray | None = None
        self.ST_EAS: np.ndarray | None = None

        self.C_opt_full = None  # used for target model

        self._calculate_EAS = True
        # self._include_rates_params = True

        super(BaseKineticModel, self).__init__(dataset, n_species, set_model)

    
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
        params = super(BaseKineticModel, self).init_params()

        params.add('t0', value=0, min=-np.inf, max=np.inf, vary=True)  # time zero at central wave

        if self.include_chirp:
            if self.chirp_type is ChirpType.EXP:
                for i in range(self.num_of_exp_chirp_params):
                    params.add(f't0_mul_{i+1}', value=0.5, min=-np.inf, max=np.inf, vary=True)
                    params.add(f't0_lam_{i+1}', value=0.01, min=-np.inf, max=np.inf, vary=True)

            else:  # polynomial by Ivo van Stokkum
                for i in range(self.num_of_poly_chirp_params):
                    params.add(f't0_p_{i+1}', value=0.5, min=-np.inf, max=np.inf, vary=True)

        if self.include_irf:
            if self.irf_type is IrfType.GAUSSIAN:
                for i in range(self.n_irfs):
                    params.add(f'irf_FWHM_{i+1}', value=0.15, min=0, max=np.inf, vary=True)  # full-width at half maxium of gaussian IRF

                if self.include_variable_fwhm:
                    for i in range(self.num_of_poly_varfwhm_params):
                        params.add(f'var_FWHM_p_{i+1}', value=0.01, min=-np.inf, max=np.inf, vary=True)   # wavelength-dependent FWHM

            elif self.irf_type is IrfType.SQUARE:  # square wave
                for i in range(self.n_irfs):
                    params.add(f'irf_SQW_{i+1}', value=0.15, min=0, max=np.inf, vary=True)  # width of the square wave

            for i in range(self.n_irfs - 1):
                params.add(f'irf_amp_{i+2}', value=0.3, min=0, max=1, vary=True)  # amplitude of the next IRF
                params.add(f'irf_mu_{i+2}', value=0, min=-np.inf, max=np.inf, vary=True)  # time shift of the next IRF


        if self.n_DOAS > 0:
            for i in range(self.n_DOAS):
                params.add(f'os_omega_{i+1}', value=2, min=0, max=np.inf, vary=True)
                params.add(f'os_tau_{i+1}', value=1, min=0, max=np.inf, vary=True)


        return params
    
    def get_irf_width(self, params: Parameters | None = None):
        params = self.params if params is None else params

        if not self.include_irf:
            return 0
        
        if self.irf_type is IrfType.GAUSSIAN:
            return params['irf_FWHM_1'].value
        elif self.irf_type is IrfType.SQUARE:
            return params['irf_SQW_1'].value

    def get_irf_amps(self, params: Parameters | None = None) -> np.ndarray:
        """
        IRF mixture amplitudes per IRF index.

        The first ("base") IRF amplitude is derived so that
        sum(amps) == 1.
        """
        params = self.params if params is None else params

        amps = np.zeros(self.n_irfs, dtype=np.float64)
        if not self.include_irf:
            amps[0] = 1.0
            return amps

        other_amp_sum = 0.0
        for irf_num in range(2, self.n_irfs + 1):
            other_amp_sum += params[f'irf_amp_{irf_num}'].value

        amps[0] = 1.0 - other_amp_sum
        for irf_num in range(2, self.n_irfs + 1):
            amps[irf_num - 1] = params[f'irf_amp_{irf_num}'].value

        return amps

    def get_irf_mu_shifts(self, params: Parameters | None = None) -> np.ndarray:
        """IRF mixture time shifts (0 for the base IRF)."""
        params = self.params if params is None else params

        mu_shifts = np.zeros(self.n_irfs, dtype=np.float64)
        if not self.include_irf:
            return mu_shifts

        for irf_num in range(2, self.n_irfs + 1):
            mu_shifts[irf_num - 1] = params[f'irf_mu_{irf_num}'].value
        return mu_shifts

    def get_tau_for_irf(self, irf_index: int, params: Parameters | None = None) -> np.ndarray | float:
        """Return the IRF width (FWHM) curve for a specific IRF in the mixture."""
        params = self.params if params is None else params

        if not self.include_irf:
            return 0

        if irf_index < 0 or irf_index >= self.n_irfs:
            raise IndexError(f"irf_index out of range: {irf_index} (n_irfs={self.n_irfs})")

        if self.irf_type is IrfType.GAUSSIAN:
            # Gaussian IRF: wavelength-dependent width via variable-FWHM polynomial (if enabled).
            base_width = params[f'irf_FWHM_{irf_index + 1}'].value
        elif self.irf_type is IrfType.SQUARE:
            # Square IRF: a single width parameter, shared by all IRFs.
            base_width = params[f'irf_SQW_{irf_index + 1}'].value
        else:
            base_width = 0

        if base_width == 0 or self.irf_type is not IrfType.GAUSSIAN:
            return base_width

        if not self.include_variable_fwhm:
            return base_width

        tau = np.ones(self.dataset.wavelengths.shape[0], dtype=np.float64) * base_width

        x = (self.dataset.wavelengths - self.central_wave) / 100
        partaus = [params[f'var_FWHM_p_{i + 1}'] for i in range(self.num_of_poly_varfwhm_params)]
        for i in range(self.num_of_poly_varfwhm_params):
            tau += partaus[i] * x ** (i + 1)

        return tau

    def get_rates(self, params: Parameters | None = None) -> np.ndarray:
        raise NotImplementedError()

    def _iter_irf_components(
        self,
        params: Parameters | None = None,
        *,
        skip_zero_amp: bool = True,
    ) -> Iterator[tuple[float, np.ndarray | float, np.ndarray | float]]:
        """
        Yield IRF mixture components as (amp, width, mu).

        - `width` is the IRF FWHM (or square width) as a scalar or wavelength array.
        - `mu` is the chirp time-zero curve shifted by the IRF's time shift.
        """
        params = self.params if params is None else params

        amps = self.get_irf_amps(params)
        mu_base = self.get_mu(params)
        mu_shifts = self.get_irf_mu_shifts(params)

        for irf_idx in range(self.n_irfs):
            amp = float(amps[irf_idx])
            if skip_zero_amp and np.isclose(amp, 0.0):
                continue
            width = self.get_tau_for_irf(irf_idx, params)
            mu = mu_base + mu_shifts[irf_idx]
            yield amp, width, mu
    
    
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
    

    def get_tau(self, params: Parameters | None = None) -> np.ndarray | float:
        """Return the curve that defines (base) IRF FWHM with respect to wavelength."""
        return self.get_tau_for_irf(0, params)

    def plot_tau(self):
        if not self.include_irf and not self.include_variable_fwhm:
            return

        plt.plot(self.dataset.wavelengths, self.get_tau())
        plt.xlabel('Wavelength / nm')
        plt.ylabel('IRF_FWHM / ps')
        plt.show()

    def plot_DOAS(self, t_unit='ps', t_lim=(None, None)):
        if self.ST_DOAS is None:
            return

        fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(15, 4.5))

        set_main_axis(ax1, y_label='Population', x_label=f'Time ({t_unit})', xlim=t_lim)
        set_main_axis(ax2, y_label='$\\Delta A$ (OD)', x_label='Wavelength (nm)')
        set_main_axis(ax3, y_label='Phase', x_label='Wavelength (nm)')

        C = self._C_DOAS
        t0 = 0

        if C.ndim == 3:
            idx = fi(self.dataset.wavelengths, self.central_wave)
            mu = self.get_mu()
            t0 = mu[idx]
            C = C[idx]
        else:
            t0 = self.get_mu()

        for i in range(self.n_DOAS):
            ax1.plot(self.dataset.times - t0, C[:, i*2], label=f'C_DOAS {i+1} cos', color=COLORS[i], lw=1.5)
            ax1.plot(self.dataset.times - t0, C[:, i*2 + 1], label=f'C_DOAS {i+1} sin', color=COLORS[i], lw=1.5, ls='--')

            ax2.plot(self.dataset.wavelengths, self.ST_DOAS[i], color=COLORS[i], lw=1.5)
            ax3.plot(self.dataset.wavelengths, self.DOAS_phases[i], color=COLORS[i], lw=1.5)

        labels = [f'DOAS {i+1}' for i in range(self.n_DOAS)]

        ax1.legend(frameon=False)
        ax2.legend(labels=labels, frameon=False)
        ax3.legend(labels=labels, frameon=False)

        # Phase axis ticks as multiples of π/2 or π, based on actual data range.
        ph = np.asarray(self.DOAS_phases, dtype=float)
        if ph.size:
            finite = np.isfinite(ph)
            if np.any(finite):
                ymin = float(np.nanmin(ph[finite]))
                ymax = float(np.nanmax(ph[finite]))
                span = ymax - ymin

                step = np.pi if span > 2 * np.pi else (np.pi / 2)
                lo = np.floor(ymin / step) * step
                hi = np.ceil(ymax / step) * step

                pad = max(0.05 * span, step / 4) if span > 0 else step / 2
                ax3.set_ylim(lo - pad, hi + pad)

                ticks = np.arange(lo, hi + 0.5 * step, step)
                ax3.set_yticks(ticks)

                def _pi_formatter(val, _pos):
                    k = val / np.pi
                    k2 = int(np.round(k * 2))  # integer in half-π units
                    if np.isclose(val, 0.0, atol=1e-12):
                        return "0"
                    if step >= np.pi * 0.999:
                        n = int(np.round(k))
                        if np.isclose(k, n, atol=1e-10):
                            if n == 1:
                                return r"$\pi$"
                            if n == -1:
                                return r"$-\pi$"
                            return rf"${n}\pi$"
                    # π/2 grid (also works if user later forces step=π/2)
                    if k2 == 1:
                        return r"$\pi/2$"
                    if k2 == -1:
                        return r"$-\pi/2$"
                    if k2 % 2 == 0:
                        n = k2 // 2
                        if n == 1:
                            return r"$\pi$"
                        if n == -1:
                            return r"$-\pi$"
                        return rf"${n}\pi$"
                    return rf"${k2}\pi/2$"

                ax3.yaxis.set_major_formatter(FuncFormatter(_pi_formatter))

        plt.tight_layout()
        plt.show()



    def get_mu(self, params: Parameters | None = None) -> np.ndarray | float:
        """Return the curve that defines chirp (time zero) with respect to wavelength."""

        params = self.params if params is None else params

        t0 = params["t0"].value

        if not self.include_chirp:
            return t0

        mu = np.ones(self.dataset.wavelengths.shape[0], dtype=np.float64) * t0

        x = self.dataset.wavelengths - self.central_wave

        if self.chirp_type is ChirpType.EXP:
            for i in range(self.num_of_exp_chirp_params):
                factor = params[f"t0_mul_{i + 1}"].value
                lam = params[f"t0_lam_{i + 1}"].value
                mu += factor * np.exp(x * lam)
        elif self.chirp_type is ChirpType.POLY:
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

        if self.chirp_type is ChirpType.EXP:
            mul, lam = fit_sum_exp(wls_vals - cv, time_vals, self.num_of_exp_chirp_params, fit_intercept=True)
            self.params['t0'].value = mul[-1]
            for i in range(self.num_of_exp_chirp_params):
                self.params[f"t0_mul_{i + 1}"].value = mul[i]
                self.params[f"t0_lam_{i + 1}"].value = lam[i]

        elif self.chirp_type is ChirpType.POLY:
            coefs = fit_polynomial_coefs(wls_vals - cv, time_vals, self.num_of_poly_chirp_params)
            self.params['t0'].value = coefs[0]
            
            for i in range(self.num_of_poly_chirp_params):
                self.params[f"t0_p_{i + 1}"].value = coefs[i+1]


    def simulate_artifacts(self, params: Parameters | None = None, zero_coh_range=None) -> np.ndarray:
        """
        Simulates coherent artifact basis profiles as derivatives of a Gaussian IRF.

        If multiple IRFs are enabled, the final artifact profile is the weighted sum
        over the IRF mixture (weighted by `irf_amp_*`, with base IRF amplitude derived
        so that the total mixture amplitude sums to 1).
        """

        if not self.include_artifacts:
            return

        params = self.params if params is None else params

        order = self.artifact_order
        t = np.atleast_1d(self.dataset.times)

        y_total: np.ndarray | None = None

        for amp, fwhm, mu in self._iter_irf_components(params, skip_zero_amp=False):

            fwhm = np.atleast_1d(fwhm)
            mu = np.atleast_1d(mu)

            tensor: bool = mu.shape[0] > 1 or fwhm.shape[0] > 1

            if tensor:
                fwhm_t = fwhm.reshape(-1, 1, 1)
                tt = t.reshape(1, -1, 1) - mu.reshape(-1, 1, 1)
                s = fwhm_t / (2 * np.sqrt(2 * np.log(2)))  # sigma
            else:
                s = fwhm[0] / (2 * np.sqrt(2 * np.log(2)))  # sigma
                tt = (t - mu[0]).reshape(-1, 1)

            y: np.ndarray = gaussian(tt, s)
            y = np.tile(y, (1, 1, order + 1)) if tensor else np.tile(y, (1, order + 1))

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

            y_total = y * amp if y_total is None else (y_total + amp * y)

        # if y_total is None:
        #     # Degenerate case: mixture amplitudes are ~0.
        #     # Fall back to the base IRF (amp=1) to infer the correct shape.
        #     fwhm = self.get_tau_for_irf(0, params)
        #     mu = mu_base + mu_shifts[0]

        #     fwhm = np.atleast_1d(fwhm)
        #     mu = np.atleast_1d(mu)

        #     tensor: bool = mu.shape[0] > 1 or fwhm.shape[0] > 1

        #     if tensor:
        #         fwhm_t = fwhm.reshape(-1, 1, 1)
        #         tt = t.reshape(1, -1, 1) - mu.reshape(-1, 1, 1)
        #         s = fwhm_t / (2 * np.sqrt(2 * np.log(2)))  # sigma
        #     else:
        #         s = fwhm[0] / (2 * np.sqrt(2 * np.log(2)))  # sigma
        #         tt = (t - mu[0]).reshape(-1, 1)

        #     y: np.ndarray = gaussian(tt, s)
        #     y = np.tile(y, (1, 1, order + 1)) if tensor else np.tile(y, (1, order + 1))

        #     if order > 0:  # first derivative
        #         y[..., 1] *= -tt.squeeze()

        #     if order > 1:  # second derivative
        #         y[..., 2] *= (tt * tt - s * s).squeeze()

        #     if order > 2:  # third derivative
        #         y[..., 3] *= (-tt * (tt * tt - 3 * s * s)).squeeze()

        #     if order > 3:  # fourth derivative
        #         y[..., 4] *= (tt ** 4 - 6 * tt * tt * s * s + 3 * s ** 4).squeeze()

        #     y_max = np.max(y, axis=-2, keepdims=True)  # find maxima over time axis
        #     y_max[np.isclose(y_max, 0)] = 1  # values close to zero force to 1 to not divide by zero
        #     y /= y_max

        #     return y

        self.C_artifacts = y_total

        # if zero_coh_range is not None:
        #     self.C_COH *= zero_coh_range[:, None, None]

        # return self.C_COH

    
    def calculate_C_profiles(self, params: Parameters | None = None, times: np.ndarray | None = None):
        raise NotImplementedError()

    def simulate_C_DOAS(self, params: Parameters | None = None):
        if self.n_DOAS == 0:
            return

        params = self.params if params is None else params

        ks = 1 / np.array([params[f'os_tau_{i+1}'].value for i in range(self.n_DOAS)])

        f_exp = fold_exp_vec if self.irf_type is IrfType.GAUSSIAN else square_conv_exp_vec

        _C = None
        for amp, width, mu in self._iter_irf_components(params, skip_zero_amp=False):
            _C_irf = exp_dist(f_exp, self.dataset.times, ks, width, None, mu)
            _C = _C_irf * amp if _C is None else (_C + amp * _C_irf)

        self._C_DOAS = np.empty(_C.shape[:-1] + (self.n_DOAS * 2,))

        omegas = np.array([params[f'os_omega_{i+1}'].value for i in range(self.n_DOAS)])
        # assert _C.shape[-1] == self.n_DOAS, (_C.shape, self.n_DOAS)

        if _C.ndim == 3:
            tt = self.dataset.times[None, :, None] - self.get_mu()[:, None, None]
            phase = tt * omegas[None, None, :]
        else:
            tt = (self.dataset.times - self.get_mu()).reshape(-1, 1)
            phase = tt * omegas[None, :]

        self._C_DOAS[..., ::2] = _C * np.cos(phase)
        self._C_DOAS[..., 1::2] = _C * np.sin(phase)

    
    def simulate(self, params: Parameters | None = None):

        self.C_opt = None
        self.C_artifacts = None
        self._C_DOAS = None
        self.ST_DOAS = None

        self.simulate_artifacts(params)

        self.simulate_C_DOAS(params)

        self.calculate_C_profiles(params, self.dataset.times)

        arrays = list(filter(lambda x: x is not None, [self.C_opt, self.C_artifacts, self._C_DOAS]))
        if len(arrays) == 0:
            return

        n_s = self.C_opt.shape[-1] if self.C_opt is not None else 0
        n_a = self.C_artifacts.shape[-1] if self.C_artifacts is not None else 0
        n_d = self._C_DOAS.shape[-1] if self._C_DOAS is not None else 0

        C_full = np.concatenate(arrays, axis=-1)

        w = self.get_weights_lstsq()

        # print(C_full.shape, self.dataset.matrix_fac.shape, w.shape if w is not None else None)

        ST_full, self.matrix_opt = glstsq(C_full, self.dataset.matrix_fac, self.ridge_alpha, w)

        if self.include_artifacts:
            self.ST_artifacts = ST_full[n_s:n_s + n_a]

        if n_s > 0:
            self.ST_opt = ST_full[:n_s]

        if n_d > 0:
            A = ST_full[n_s + n_a::2]  # cos
            B = ST_full[1 + n_s + n_a::2]  # sin
            self.ST_DOAS = np.sqrt(A*A + B*B)
            # Phase for A*cos(.) + B*sin(.) is atan2(B, A); keep it in [0, 2π).
            # self.DOAS_phases = np.mod(np.arctan2(B, A), 2 * np.pi)
            # https://github.com/glotaran/pyglotaran/blob/2dfe53a22add43a0829541255268e9a0c2c0978c/glotaran/builtin/megacomplexes/damped_oscillation/damped_oscillation_megacomplex.py#L149
            self.DOAS_phases = np.unwrap(np.arctan2(B, A))  # the same as in pyglotaran


        if self._calculate_EAS and self.C_opt is not None:
            # calculation of EAS profiles and spectra
            ks = self.get_rates(params)
            A = get_EAS_transform(ks)
            self.C_EAS = self.C_opt.dot(A)
            self.ST_EAS = np.linalg.inv(A).dot(self.ST_opt)

    def residuals(self, params: Parameters):
        self.simulate(params)
        return self.weighted_residuals()

    def fit(self):
        # iter_cb - callback function
        self.minimizer = Minimizer(self.residuals, self.params, nan_policy='omit') #,
                                        #  iter_cb=lambda params, iter, resid, *args, **kws: self.is_interruption_requested())
        
        self.fit_result = self.minimizer.minimize(method=self.fit_algorithm, **self.fitter_kwds)  # minimize the residuals
        self.params = self.fit_result.params

    def add_amplitudes_to_params(self, params: Parameters | None = None, max_amplitudes = 10):
        params = self.params if params is not None else params

        assert self.ST_opt is not None

        norm_amps = (self.ST_opt / self.ST_opt.sum()).squeeze()

        assert norm_amps.shape[0] <= max_amplitudes

        for i, a in enumerate(norm_amps):
            self.params.add(f"A_{i+1}", value=a, vary=False)

    def plot_SVD(self, n_values: int | None = 15, n_left_vectors: int = 5, n_right_vectors: int = 5, use_chirp_correction: bool = True,
                 filepath: bool | None = None, transparent: bool = True, dpi: int = 300, figsize=(17, 5)):

        fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=figsize)

        set_main_axis(ax1, x_label='Singular value', y_label=f'Magnitude')
        set_main_axis(ax2, x_label='', y_label=f'Magnitude')
        set_main_axis(ax3, x_label='', y_label=f'Magnitude')

        D = self.dataset.matrix_fac
        times = self.dataset.times

        if use_chirp_correction:
            mu = self.get_mu()
            D, times = chirp_correction(D, times, mu)

        U, S, VT = svd(D, full_matrices=False)

        # plot first 20 singular values of both datasets and combined dataset
        ax1.scatter(np.arange(1, n_values + 1), S[:n_values], color='r', edgecolors='darkred')
        ax1.set_yscale('log')
        ax1.set_xticks(np.arange(1, n_values + 1))

        # plot the left singular vectors
        ax2.plot(U[:, :n_left_vectors])
        ax2.legend([f'$\\bf v_{i+1}$' for i in range(n_left_vectors)], frameon=False)
        ax2.set_title("Time singular vector")
        ax2.set_xticks([]) # Removes both ticks and labels
        ax2.set_xticklabels([]) # Removes only labels

        # plot the right singular vectors
        ax3.plot(VT[:n_right_vectors].T)
        ax3.legend([f'$\\bf v_{i+1}$' for i in range(n_right_vectors)], frameon=False)
        ax3.set_title("Spectral singular vector")
        ax3.set_xticks([]) # Removes both ticks and labels
        ax3.set_xticklabels([]) # Removes only labels

        plt.tight_layout()
        if filepath:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, bbox_inches='tight', transparent=transparent, dpi=dpi)
        else:
            plt.show()


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
        t_unit=kwargs.get('t_unit', 'ps')

        def update_kwargs(prefix: str, kwargs: dict):
            for key, value in kwargs.copy().items():
                if key.startswith(prefix.lower()):
                    _key = key[len(prefix) + 1:]  # to account for _ symbol
                    kwargs[_key] = value
        f_labels = list('abcdefghijklmnopqrstuvwxyz')
        f_labels += [s + s for s in f_labels]

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

                    title = kws.pop('title', self.dataset.name)

                    plot_fitresiduals_axes(ax, ax_res, self.dataset.times, mat, opt, res, title=title, mu=mu, **kws)

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
                    lam = kws.get('cprofiles_lambda', None) # wavelength for C profiles to use
                    update_kwargs("cprofiles", kws)  # change to data-specific kwargs

                    if self.C_opt.ndim == 3:
                        idx = 0
                        if lam is not None:
                            idx = fi(self.dataset.wavelengths, lam)
                            kws.update(dict(mu=mu[idx]))
                        _C = self.C_opt_full[idx] if self.C_opt_full is not None else self.C_opt[idx]
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
                    plot_SADS_ax(ax, self.dataset.wavelengths, self.ST_EAS.T, 
                    Artifacts=self.ST_artifacts.T if self.ST_artifacts is not None else None, 
                    DOAS=self.ST_DOAS.T if self.ST_DOAS is not None else None,
                    **kws)
                case "eas-norm":
                    kws.update(dict(title="EAS-norm", colors=COLORS, labels=self.get_labels(t_unit)))
                    update_kwargs("eas-norm", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, (self.ST_EAS / self.ST_EAS.max(axis=1, keepdims=True)).T, **kws)
                case "das":
                    kws.update(dict(title="DAS", colors=COLORS, labels=self.get_labels(t_unit)))
                    update_kwargs("das", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, self.ST_opt.T if self.ST_opt is not None else None,
                     Artifacts=self.ST_artifacts.T if self.ST_artifacts is not None else None,
                     DOAS=self.ST_DOAS.T if self.ST_DOAS is not None else None,
                     **kws)
                case "sas":
                    kws.update(dict(title="SAS", colors=COLORS, labels=self.get_labels(t_unit)))
                    update_kwargs("sas", kws)  # change to data-specific kwargs
                    plot_SADS_ax(ax, self.dataset.wavelengths, self.ST_opt.T, 
                    Artifacts=self.ST_artifacts.T if self.ST_artifacts is not None else None,
                    DOAS=self.ST_DOAS.T if self.ST_DOAS is not None else None,
                    **kws)
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



