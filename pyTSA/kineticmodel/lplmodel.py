from __future__ import annotations
import os
from typing import Callable, Literal

import numpy as np
from lmfit import Parameters, Minimizer, conf_interval, conf_interval2d, report_ci
from lmfit.minimizer import MinimizerResult

from abc import abstractmethod
from enum import Enum, auto

from scipy.integrate import solve_ivp
from scipy.stats import skewnorm


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
        # self.temp_dep_rates: list[str] = []
        self.n_E: int = 50  # number of points to simulate the gaussian distribution of trap depths
        self.n_r: int = 50  # number of points to simulate the radial distribution for tunneling
        self.E_min = 0.01  #  minimum trap depth in eV
        self.E_max = 2  #  maximum trap depth in eV
        self.r_min = 0.1  #  minimum tunneling distance in nm
        self.r_max = 50  #  maximum tunneling distance in nm

        # 1D trap-depth distribution (LPLModelCT / ST / ...)
        self.n_gaussians: int = 1
        self.add_exp_distribution: bool = False
        # 2D separable (r, E) distributions (LPLModelCT2D)
        self.n_gaussians_trap_depth: int = 1
        self.n_gaussians_tunneling: int = 1
        self.add_exp_distribution_trap_depth: bool = False
        self.add_exp_distribution_tunneling: bool = False

        self.Es: np.ndarray = None
        self.rs: np.ndarray = None
        self.t_acum: np.ndarray = None
        self.accum_phase_solution: None | np.ndarray = None
        self.lpl_phase_solution: None | np.ndarray = None

        self.pair_conc: None | np.ndarray = None

        self.ridge_alpha = 0.0001

        self.initial_state: None | Callable = None
        self.temp_fun: Callable | None = None  # takes time as argument

        super(LPLModel, self).__init__(dataset, n_species, set_model)

    @property
    def n_ode_states(self) -> int:
        """Number of ODE state variables (species + trap bins)."""
        return self.n_E + self.n_species

    def init_params(self) -> Parameters:
        params = super(LPLModel, self).init_params()

        for i in range(self.n_gaussians):
            params.add(f'rho_amp_{i}', value=1, min=0, max=np.inf, vary=True)
            params.add(f'rho_loc_{i}', value=1, min=0.3, max=self.E_max, vary=True)
            params.add(f'rho_scale_{i}', value=0.2, min=0.001, max=self.E_max, vary=True)
            params.add(f'rho_skew_{i}', value=0, min=-20, max=20, vary=True)

        if self.add_exp_distribution:
            params.add('rho_exp_amp', value=1, min=0, max=np.inf, vary=True)
            params.add('rho_exp_lambda', value=10, min=0, max=np.inf, vary=True)

        params.add('s0', value=1e13, min=0, max=np.inf, vary=False)
        params.add('beta', value=1, min=0, max=np.inf, vary=False)

        return params

    @staticmethod
    def arrhenius(E: np.ndarray, T: np.ndarray) -> np.ndarray:
        """Boltzmann factor exp(-E / kB*T); E in eV, T in K."""
        return np.exp(-E / (KB_EV * T))
    
    @staticmethod
    def miller_abraham_rate(r: np.ndarray, E: np.ndarray, T: float, beta: float = 1, s0: float = 1e13) -> np.ndarray:
        # r is in nm, E is in eV, T is in K, beta is the tunneling factor, s0 is the prefactor
        return s0 * np.exp(-2 * beta * r - E / (KB_EV * T))

    @staticmethod
    def gaussian(Es: np.ndarray, mu: float, sigma: float) -> np.ndarray:
        return np.exp(-(Es - mu)**2 / (2 * sigma**2)) / (sigma * np.sqrt(2 * np.pi))

    @staticmethod
    def trapezoid_weights(xs: np.ndarray) -> np.ndarray:
        w = np.full(len(xs), xs[1] - xs[0])
        w[0] /= 2
        w[-1] /= 2
        return w

    @staticmethod
    def trapezoid_weights_2D(axis_0: np.ndarray, axis_1: np.ndarray) -> np.ndarray:
        dx = axis_0[1] - axis_0[0]
        dy = axis_1[1] - axis_1[0]
        x = np.full(axis_0.size, dx)
        y = np.full(axis_1.size, dy)
        x[0] /= 2
        y[0] /= 2
        x[-1] /= 2
        y[-1] /= 2
        return np.outer(x, y)

    def get_rho_0(self, params: Parameters | None = None) -> np.ndarray:
        params = self.params if params is None else params

        Es = np.linspace(self.E_min, self.E_max, self.n_E)
        self.Es = Es

        rho_0 = np.zeros(self.n_E)
        for i in range(self.n_gaussians):
            rho_0 += params[f'rho_amp_{i}'].value * skewnorm.pdf(
                Es, params[f'rho_skew_{i}'].value,
                loc=params[f'rho_loc_{i}'].value,
                scale=params[f'rho_scale_{i}'].value,
            )

        if self.add_exp_distribution:
            rho_0 += params['rho_exp_amp'].value * np.exp(-Es / params['rho_exp_lambda'].value)

        return rho_0

    def get_rho_0_2D(self, params: Parameters | None = None) -> tuple[np.ndarray, np.ndarray]:
        params = self.params if params is None else params

        Es = np.linspace(self.E_min, self.E_max, self.n_E)
        rs = np.linspace(self.r_min, self.r_max, self.n_r)
        self.Es = Es
        self.rs = rs

        rho_0_E = np.zeros(self.n_E)
        rho_0_r = np.zeros(self.n_r)
        for i in range(self.n_gaussians_trap_depth):
            rho_0_E += params[f'rho_amp_E_{i}'].value * skewnorm.pdf(
                Es, params[f'rho_skew_E_{i}'].value,
                loc=params[f'rho_loc_E_{i}'].value,
                scale=params[f'rho_scale_E_{i}'].value,
            )

        if self.add_exp_distribution_trap_depth:
            rho_0_E += params['rho_exp_amp_E'].value * np.exp(-Es / params['rho_exp_lambda_E'].value)

        for i in range(self.n_gaussians_tunneling):
            rho_0_r += params[f'rho_amp_r_{i}'].value * skewnorm.pdf(
                rs, params[f'rho_skew_r_{i}'].value,
                loc=params[f'rho_loc_r_{i}'].value,
                scale=params[f'rho_scale_r_{i}'].value,
            )

        if self.add_exp_distribution_tunneling:
            rho_0_r += params['rho_exp_amp_r'].value * np.exp(-rs / params['rho_exp_lambda_r'].value)

        return rho_0_r, rho_0_E

    def build_saturable_rhs_jac(self, params: Parameters, T_fun: Callable, I_fun: Callable):
        raise NotImplementedError("This method is not implemented for the base LPLModel class.")


    def simulate(self, params: Parameters | None = None, times: np.ndarray | None = None) -> np.ndarray:
        params = self.params if params is None else params

        if self.initial_state is None:
            u0 = np.zeros(self.n_ode_states)
        else:
            u0 = self.initial_state()

        ivp_kw = dict(method="BDF", rtol=1e-6, atol=1e-10)  # , first_step=1e-14

        self.I0 = self.P_irr_mW * 1e-3 * self.lambda_irr_nm * 1e-9 / (sc.h * sc.c) # light intensity in photons / s

        # --- accumulation phase: constant illumination I0 at temperature T ---
        rhs_acc, jac_acc = self.build_saturable_rhs_jac(params, T_fun=lambda t: self.temp_fun(t), I_fun=lambda t: self.I0)
        self.t_acum = np.linspace(0, self.exposure_time_s, 100)
        sol_acc = solve_ivp(rhs_acc, (0, self.exposure_time_s), u0, **ivp_kw, jac=jac_acc, t_eval=self.t_acum)
        if not sol_acc.success:
            raise RuntimeError(f"accumulation integration failed: {sol_acc.message}")

        # --- LPL decay phase: light off ---
        rhs_dec, jac_dec = self.build_saturable_rhs_jac(params, T_fun=lambda t: self.temp_fun(t), I_fun=lambda t: 0.0)
        t_lpl = self.dataset.times if self.dataset is not None else times
        if t_lpl is None:
            raise ValueError("times are not provided")
        sol_dec = solve_ivp(rhs_dec, (0, t_lpl[-1]), sol_acc.y[:, -1], **ivp_kw, jac=jac_dec, t_eval=t_lpl)
        if not sol_dec.success:
            raise RuntimeError(f"LPL integration failed: {sol_dec.message}")

        self.accum_phase_solution = sol_acc.y
        self.lpl_phase_solution = sol_dec.y

        self.process_solution(params)

    def process_solution(self, params: Parameters | None = None):
        raise NotImplementedError("This method is not implemented for the base LPLModel class.")

    def _is_2d_trap_grid(self, rho_flat: np.ndarray) -> bool:
        return rho_flat.size == self.n_E * self.n_r

    def get_trap_marginal(self, rho_flat: np.ndarray, dim: Literal['E', 'r']):
        """Marginalize a flattened trap density onto ``E`` or ``r``.

        For 1-D models only ``dim='E'`` is valid. For 2-D ``(r, E)`` grids,
        ``dim='E'`` integrates over ``r`` and ``dim='r'`` integrates over ``E``.

        Returns
        -------
        x, rho_m, rho0_m : axis values, marginal density, and empty-trap marginal
        """
        if not self._is_2d_trap_grid(rho_flat):
            if dim != 'E':
                raise ValueError("Radial trap marginals require a 2D (r, E) trap grid.")
            if self.Es is None:
                self.get_rho_0()
            return self.Es, rho_flat, self.get_rho_0()

        if self.rs is None or self.Es is None:
            self.get_rho_0_2D()

        rho = rho_flat.reshape(self.n_r, self.n_E)
        wr = self.trapezoid_weights(self.rs)
        wE = self.trapezoid_weights(self.Es)
        rho0 = np.outer(*self.get_rho_0_2D())

        if dim == 'E':
            return self.Es, np.sum(wr[:, None] * rho, axis=0), np.sum(wr[:, None] * rho0, axis=0)
        if dim == 'r':
            return self.rs, np.sum(wE[None, :] * rho, axis=1), np.sum(wE[None, :] * rho0, axis=1)
        raise ValueError(f"Unknown trap marginal dimension {dim!r}; use 'E' or 'r'.")

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

                case "dist-acum-e" | "dist-acum-r" | "dist-decay-e" | "dist-decay-r":
                    self._require_simulation()
                    update_kwargs(p.lower(), kws)

                    dim: Literal['E', 'r'] = 'r' if p.lower().endswith('-r') else 'E'
                    is_acum = 'acum' in p.lower()
                    times = self.t_acum if is_acum else self.dataset.times
                    sol = self.accum_phase_solution if is_acum else self.lpl_phase_solution
                    step = kws.pop('step', 5)
                    idxs = np.arange(0, len(times), step)
                    norm = Normalize(times[0], times[-1]) if is_acum else LogNorm(times[0], times[-1])
                    is_2d = self._is_2d_trap_grid(sol[n:, 0])

                    x, _, rho0_m = self.get_trap_marginal(sol[n:, 0], dim)
                    for j in idxs:
                        _, rho_m, _ = self.get_trap_marginal(sol[n:, j], dim)
                        ax.plot(x, rho_m, color=cmap(norm(times[j])), lw=1)
                    ax.plot(x, rho0_m, color='black', lw=1, ls='--')

                    phase = 'Charging' if is_acum else 'Recombination'
                    if getattr(self, 'iso_rate_axis', False) and dim == 'E':
                        ax.set_xlabel(r'$\log_{10} k$ [s$^{-1}$]')
                        ax.set_ylabel(r'$N(k)$')
                        expr = r'N(k,t)'
                    elif dim == 'E':
                        ax.set_xlabel('E [eV]')
                        ax.set_ylabel(r'$\int\rho(r,E)\,dr$' if is_2d else r'$\rho(E)$')
                        expr = r'\int\rho(r,E,t)\,dr' if is_2d else r'\rho(E,t)'
                    else:
                        ax.set_xlabel('r [nm]')
                        ax.set_ylabel(r'$\int\rho(r,E)\,dE$')
                        expr = r'\int\rho(r,E,t)\,dE'
                    ax.set_title(kws.pop('title', rf'{phase}: ${expr}$'))
                    cbar_label = 't [s]' if is_acum else 't after irr. [s]'
                    fig.colorbar(plt.cm.ScalarMappable(cmap=cmap, norm=norm), ax=ax, label=cbar_label)

                case "dist-decay-2d" | "dist-acum-2d":
                    self._require_simulation()
                    update_kwargs(p.lower(), kws)

                    is_acum = 'acum' in p.lower()
                    times = self.t_acum if is_acum else self.dataset.times
                    sol = self.accum_phase_solution if is_acum else self.lpl_phase_solution
                    if not self._is_2d_trap_grid(sol[n:, 0]):
                        raise ValueError("2D trap heatmap requires a 2D (r, E) trap grid.")

                    t_plot = kws.pop('t_2D', None)
                    j = int(np.argmin(np.abs(times - t_plot))) if t_plot is not None else -1
                    if self.rs is None or self.Es is None:
                        self.get_rho_0_2D()

                    rho = sol[n:, j].reshape(self.n_r, self.n_E)
                    cmap_hm = kws.pop('cmap', plt.cm.viridis)
                    use_log = kws.pop('log', False)
                    vmin = kws.pop('vmin', None)
                    vmax = kws.pop('vmax', None)
                    if use_log:
                        pos = rho[rho > 0]
                        if vmin is None:
                            vmin = float(pos.min()) if pos.size else 1e-30
                        if vmax is None:
                            vmax = float(rho.max()) if np.any(rho > 0) else 1.0
                        norm_hm = LogNorm(vmin=vmin, vmax=max(vmax, vmin * 1.0001))
                    else:
                        norm_hm = Normalize(vmin=vmin, vmax=vmax)

                    mesh = ax.pcolormesh(self.Es, self.rs, rho, shading='auto', cmap=cmap_hm, norm=norm_hm)
                    ax.set_xlabel('E [eV]')
                    ax.set_ylabel('r [nm]')
                    phase = 'Charging' if is_acum else 'Recombination'
                    ax.set_title(kws.pop('title', rf'{phase}: $\rho(r,E)$ at $t={times[j]:.3g}$ s'))
                    fig.colorbar(mesh, ax=ax, label=r'$\rho(r,E)$')

                case "empty":
                    ax.set_axis_off()
                    continue

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
        params = super().init_params()

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


class LPLModelCT2D(LPLModel):
    """

    Attributes
    ----------

    Methods
    -------

    """

    name = "LPL model with single CT state 2D"

    @property
    def n_ode_states(self) -> int:
        return self.n_E * self.n_r + self.n_species

    def init_params(self) -> Parameters:
        # Skip LPLModel 1-D trap params; use separable (r, E) distributions.
        params = super(LPLModel, self).init_params()

        for i in range(self.n_gaussians_trap_depth):
            params.add(f'rho_amp_E_{i}', value=1, min=0, max=np.inf, vary=True)
            params.add(f'rho_loc_E_{i}', value=1, min=0.3, max=self.E_max, vary=True)
            params.add(f'rho_scale_E_{i}', value=0.2, min=0.001, max=self.E_max, vary=True)
            params.add(f'rho_skew_E_{i}', value=0, min=-20, max=20, vary=True)

        if self.add_exp_distribution_trap_depth:
            params.add('rho_exp_amp_E', value=1, min=0, max=np.inf, vary=True)
            params.add('rho_exp_lambda_E', value=10, min=0, max=np.inf, vary=True)

        for i in range(self.n_gaussians_tunneling):
            params.add(f'rho_amp_r_{i}', value=1, min=0, max=np.inf, vary=True)
            params.add(f'rho_loc_r_{i}', value=5, min=self.r_min, max=self.r_max, vary=True)
            params.add(f'rho_scale_r_{i}', value=2, min=0.001, max=self.r_max, vary=True)
            params.add(f'rho_skew_r_{i}', value=0, min=-20, max=20, vary=True)

        if self.add_exp_distribution_tunneling:
            params.add('rho_exp_amp_r', value=1, min=0, max=np.inf, vary=True)
            params.add('rho_exp_lambda_r', value=10, min=0, max=np.inf, vary=True)

        params.add('s0', value=1e13, min=0, max=np.inf, vary=False)
        params.add('beta', value=1, min=0, max=np.inf, vary=True)

        params.add('amp_CT', value=1, min=0, max=np.inf, vary=True)
        params.add('k_sep', value=1e5, min=0, max=1e10, vary=True)
        params.add('k_CT_rnr', value=1e7, min=0, max=1e10, vary=True)

        return params

    def build_saturable_rhs_jac(self, params: Parameters, T_fun: Callable, I_fun: Callable):
        """RHS and analytic Jacobian of the arrowhead system with a
        *saturable* trapping term (Pauli blocking) on a (r, E) grid.

        Recombination uses the Miller–Abrahams rate
        ``k(r,E,T) = s0 * exp(-2 β r - E / k_B T)``.

        T_fun(t), I_fun(t): temperature and generation-rate protocols, which
        lets the same system serve isothermal charging, LPL decay, and TL ramps.
        """

        rho_0_r, rho_0_E = self.get_rho_0_2D(params)
        rho_0 = np.outer(rho_0_r, rho_0_E)

        NE = self.n_E
        NR = self.n_r
        N = NR * NE
        idx = np.arange(1, N + 1)
        w = self.trapezoid_weights_2D(self.rs, self.Es)
        N_tot = np.sum(w * rho_0)

        s0 = params['s0'].value
        beta = params['beta'].value
        k_sep = params['k_sep'].value
        k_rnr = params['k_CT_rnr'].value

        def rhs(t, u):
            k_CR = self.miller_abraham_rate(self.rs[:, None], self.Es[None, :], T_fun(t), beta, s0)
            nS, rho = u[0], u[1:]
            _rho = rho.reshape(NR, NE)
            q = np.maximum(rho_0 - _rho, 0.0) / N_tot  # vacant fraction density; int q in [0, 1]
            CS = k_sep * nS * q
            CR = k_CR * _rho
            dn = I_fun(t) - k_rnr * nS - np.sum(w * (CS - CR))
            return np.concatenate(([dn], (CS - CR).ravel()))

        def jac(t, u):
            k_CR = self.miller_abraham_rate(self.rs[:, None], self.Es[None, :], T_fun(t), beta, s0)
            nS, rho = u[0], u[1:]
            _rho = rho.reshape(NR, NE)
            q = np.maximum(rho_0 - _rho, 0.0) / N_tot
            # d(capture)/d(rho) = -k_sep*nS/N_tot, only where not clipped full
            blocking = np.where(q > 0, k_sep * nS / N_tot, 0.0)
            J = np.zeros((N + 1, N + 1))
            J[0, 0] = -k_rnr - k_sep * np.sum(w * q)
            J[0, 1:] = (w * (k_CR + blocking)).ravel()
            J[1:, 0] = (k_sep * q).ravel()
            J[idx, idx] = -(k_CR + blocking).ravel()
            return J

        return rhs, jac

    def process_solution(self, params: Parameters | None = None):
        params = self.params if params is None else params

        exc_state = self.lpl_phase_solution[0, :][:, None]
        w = self.trapezoid_weights_2D(self.rs, self.Es)
        rho = self.lpl_phase_solution[1:, :].reshape(self.n_r, self.n_E, -1)
        self.pair_conc = np.sum(w[..., None] * rho, axis=(0, 1))[:, None]

        amp = params['amp_CT'].value
        self.matrix_opt = amp * exc_state


class LPLModelCTiso2D(LPLModelCT2D):
    """Isothermal 2D trap model collapsed onto a 1D Miller–Abrahams rate grid.

    Uses the same separable ``(r, E)`` distribution parameters as
    ``LPLModelCT2D``. At the temperature ``T_fun(0)`` the 2D capacity
    ``w ρ0(r,E)`` is histogrammed onto ``n_k`` log-spaced rate bins
    ``k = s0 exp(-2 β r - E / k_B T)``. The ODE then has ``n_k + 1``
    states (CT + iso-k groups) instead of ``n_r n_E + 1``.

    Valid only for isothermal charging/decay: group rates are frozen at
    the grouping temperature. ``dist-*-E`` plots show capacity vs
    ``log10 k``.
    """

    name = "LPL model with single CT state, isothermal 2D (rate-binned)"
    iso_rate_axis = True

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1, set_model: bool = False):
        self.n_k: int = 80
        self.ks: np.ndarray | None = None
        self.T_iso: float | None = None
        super().__init__(dataset, n_species, set_model)

    @property
    def n_ode_states(self) -> int:
        return self.n_k + self.n_species

    def _project_iso_rate(self, params: Parameters, T: float):
        """Push ``w ρ0(r,E)`` onto ``n_k`` log-``k`` bins at temperature ``T``."""
        rho_0_r, rho_0_E = self.get_rho_0_2D(params)
        rho_0 = np.outer(rho_0_r, rho_0_E)
        cap = self.trapezoid_weights_2D(self.rs, self.Es) * rho_0
        N_tot = float(cap.sum())

        s0 = params['s0'].value
        beta = params['beta'].value
        k = np.maximum(
            self.miller_abraham_rate(self.rs[:, None], self.Es[None, :], T, beta, s0),
            1e-300,
        )
        k_flat = k.ravel()
        cap_flat = cap.ravel()

        k_min = float(k_flat.min())
        k_max = float(k_flat.max())
        if not np.isfinite(k_max) or k_max <= k_min:
            edges = np.array([k_min, k_min * 10.0])
            n_k = 1
        else:
            edges = np.logspace(np.log10(k_min), np.log10(k_max), self.n_k + 1)
            n_k = self.n_k

        bin_idx = np.clip(np.digitize(k_flat, edges, right=True) - 1, 0, n_k - 1)
        N0 = np.zeros(n_k)
        k_wsum = np.zeros(n_k)
        np.add.at(N0, bin_idx, cap_flat)
        np.add.at(k_wsum, bin_idx, cap_flat * k_flat)

        ks = np.sqrt(edges[:-1] * edges[1:])
        occupied = N0 > 0
        ks[occupied] = k_wsum[occupied] / N0[occupied]
        return N0, ks, N_tot

    def get_rho_0(self, params: Parameters | None = None) -> np.ndarray:
        params = self.params if params is None else params
        T = self.T_iso
        if T is None:
            T = float(self.temp_fun(0.0)) if self.temp_fun is not None else 300.0
        N0, ks, _ = self._project_iso_rate(params, T)
        self.ks = ks
        self.Es = np.log10(ks)
        return N0

    def build_saturable_rhs_jac(self, params: Parameters, T_fun: Callable, I_fun: Callable):
        """Same saturable CT / trap system as ``LPLModelCT``, on iso-``k`` bins.

        Rates are frozen at ``T_fun(0)`` (isothermal grouping).
        """
        T = float(T_fun(0.0))
        self.T_iso = T
        N0, ks, N_tot = self._project_iso_rate(params, T)
        self.ks = ks
        self.Es = np.log10(ks)

        if N_tot <= 0:
            raise ValueError("Projected trap capacity N_tot is zero; check (r, E) distributions.")

        NK = self.n_k
        idx = np.arange(1, NK + 1)
        k_sep = params['k_sep'].value
        k_rnr = params['k_CT_rnr'].value

        def rhs(t, u):
            nS, N = u[0], u[1:]
            q = np.maximum(N0 - N, 0.0) / N_tot
            CS = k_sep * nS * q
            CR = ks * N
            dn = I_fun(t) - k_rnr * nS - np.sum(CS - CR)
            return np.concatenate(([dn], CS - CR))

        def jac(t, u):
            nS, N = u[0], u[1:]
            q = np.maximum(N0 - N, 0.0) / N_tot
            blocking = np.where(q > 0, k_sep * nS / N_tot, 0.0)
            J = np.zeros((NK + 1, NK + 1))
            J[0, 0] = -k_rnr - k_sep * np.sum(q)
            J[0, 1:] = ks + blocking
            J[1:, 0] = k_sep * q
            J[idx, idx] = -ks - blocking
            return J

        return rhs, jac

    def process_solution(self, params: Parameters | None = None):
        params = self.params if params is None else params

        exc_state = self.lpl_phase_solution[0, :][:, None]
        self.pair_conc = np.sum(self.lpl_phase_solution[1:, :], axis=0)[:, None]
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
        params = super().init_params()

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


class LPLModelSTDispersion(LPLModel):
    """Singlet/triplet LPL model with a 1-D correlated rate dispersion.

    Each quadrature node ``z`` is a molecular subpopulation. Generation,
    trapping, and recombination return are weighted by the truncated
    Gaussian density ``p(z)``; each node has its own (lognormally mapped)
    rates, coupled through the shared latent coordinate ``z``.

    ``rate_z_corr`` sets how each rate tracks ``z``: ``+1`` (default) is
    fully correlated, ``-1`` is anticorrelated, ``0`` ignores ``z``.
    Example:: ``model.rate_z_corr['k_isc'] = -1``.
    """

    name = "LPL model with singlet and triplet states with rate constant dispersion"

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1, set_model: bool = False):

        self.n_disp = 30  # number of dispersion points for singlet and triplet state
        self.n_species = 2 * self.n_disp
        self.kST_points = np.linspace(-3, 3, self.n_disp)
        self.kST_weights = self.trapezoid_weights(self.kST_points)
        self.rate_z_corr = dict(k_S_rnr=1, k_T_rnr=1, k_isc=1, k_risc=1)

        super().__init__(dataset, 2 * self.n_disp, set_model)


    def init_params(self) -> Parameters:
        params = super().init_params()

        # global amplitude for multi-experiment fit
        params.add('amp_S', value=1, min=0, max=np.inf, vary=True)
        params.add('amp_T', value=1, min=0, max=np.inf, vary=True)
        params.add('k_sep', value=1e5, min=0, max=1e10, vary=True)
        params.add('k_S_rnr', value=1e5, min=0, max=1e10, vary=True)
        params.add('k_S_rnr_sigma', value=0, min=0, max=np.inf, vary=True)
        params.add('k_T_rnr', value=1, min=0, max=1e10, vary=True)
        params.add('k_T_rnr_sigma', value=0, min=0, max=np.inf, vary=True)
        params.add('k_isc', value=1e2, min=0, max=1e10, vary=True)
        params.add('k_isc_sigma', value=0, min=0, max=np.inf, vary=True)
        params.add('k_risc', value=0, min=0, max=1e10, vary=True)
        params.add('k_risc_sigma', value=0, min=0, max=np.inf, vary=True)

        return params

    def _lognormal_rates(self, rate: float, sigma: float, corr: float = 1) -> np.ndarray:
        """Map the shared latent coordinate ``z`` to a strictly positive rate.

        ``rate`` and ``sigma`` are the arithmetic mean and standard
        deviation of the implied lognormal. ``corr`` is the coupling to
        ``z`` (``+1`` correlated, ``-1`` anticorrelated, ``0`` constant).
        ``sigma == 0`` recovers a constant rate; ``rate <= 0`` returns
        zeros (e.g. disabled RISC).

        # sigma is relative to the rate, so it can be [0, 1] typically but can be larger
        """

        sigma = sigma * rate

        z = self.kST_points
        if rate <= 0:
            return np.zeros_like(z)
        if sigma <= 0 or corr == 0:
            return np.full_like(z, rate)

        log_sigma = np.sqrt(np.log1p((sigma / rate) ** 2))
        a = corr * log_sigma
        return rate * np.exp(a * z - 0.5 * a ** 2)

    def _population_pdf(self) -> np.ndarray:
        p = self.gaussian(self.kST_points, 0, 1)
        return p / np.dot(self.kST_weights, p)

    def build_saturable_rhs_jac(self, params: Parameters, T_fun: Callable, I_fun: Callable):
        """RHS and analytic Jacobian of the arrowhead system with a
        *saturable* trapping term (Pauli blocking).

        T_fun(t), I_fun(t): temperature and generation-rate protocols, which
        lets the same system serve isothermal charging, LPL decay, and TL ramps.
        """

        rho_0 = self.get_rho_0(params)

        NE = len(self.Es)
        n = self.n_species
        n_disp = self.n_disp
        N_tot = np.trapezoid(rho_0, self.Es)
        w_E = self.trapezoid_weights(self.Es)
        w_z = self.kST_weights
        p = self._population_pdf()

        s0 = params['s0'].value
        k_sep = params['k_sep'].value
        fS = 1 / 4
        fT = 3 / 4

        corr = self.rate_z_corr
        k_S_rnr_points = self._lognormal_rates(params['k_S_rnr'].value, params['k_S_rnr_sigma'].value, corr['k_S_rnr'])
        k_T_rnr_points = self._lognormal_rates(params['k_T_rnr'].value, params['k_T_rnr_sigma'].value, corr['k_T_rnr'])
        k_isc_points = self._lognormal_rates(params['k_isc'].value, params['k_isc_sigma'].value, corr['k_isc'])
        k_risc_points = self._lognormal_rates(params['k_risc'].value, params['k_risc_sigma'].value, corr['k_risc'])

        def rhs(t, u):
            kE = s0 * self.arrhenius(self.Es, T_fun(t))
            nS = u[:n_disp]
            nT = u[n_disp:n]
            rho = u[n:]
            q = np.maximum(rho_0 - rho, 0.0) / N_tot  # vacant fraction density; int q in [0, 1]
            nS_tot = np.dot(w_z, nS)
            vacant_fraction = np.dot(w_E, q)
            CS = k_sep * nS_tot * q
            CR = kE * rho
            rec_sum = np.dot(w_E, CR)

            dnS = p * I_fun(t) - (k_S_rnr_points + k_isc_points) * nS + fS * rec_sum * p + k_risc_points * nT - k_sep * vacant_fraction * nS
            dnT = k_isc_points * nS - (k_T_rnr_points + k_risc_points) * nT + fT * rec_sum * p

            return np.concatenate((dnS, dnT, CS - CR))

        def jac(t, u):
            kE = s0 * self.arrhenius(self.Es, T_fun(t))
            nS = u[:n_disp]
            rho = u[n:]
            q = np.maximum(rho_0 - rho, 0.0) / N_tot
            blocking = q > 0
            vacant_fraction = np.dot(w_E, q)
            nS_tot = np.dot(w_z, nS)
            rec_grad = w_E * kE
            Q_grad = np.where(blocking, -w_E / N_tot, 0.0)

            J = np.zeros((n + NE, n + NE))
            np.fill_diagonal(J[:n_disp, :n_disp], -(k_S_rnr_points + k_isc_points + k_sep * vacant_fraction))
            np.fill_diagonal(J[:n_disp, n_disp:n], k_risc_points)
            J[:n_disp, n:] = fS * p[:, None] * rec_grad[None, :] - k_sep * nS[:, None] * Q_grad[None, :]

            np.fill_diagonal(J[n_disp:n, :n_disp], k_isc_points)
            np.fill_diagonal(J[n_disp:n, n_disp:n], -(k_T_rnr_points + k_risc_points))
            J[n_disp:n, n:] = fT * p[:, None] * rec_grad[None, :]

            J[n:, :n_disp] = k_sep * q[:, None] * w_z[None, :]
            np.fill_diagonal(J[n:, n:], -kE - np.where(blocking, k_sep * nS_tot / N_tot, 0.0))
            return J

        return rhs, jac

    def process_solution(self, params: Parameters | None = None):
        params = self.params if params is None else params

        nS = self.lpl_phase_solution[:self.n_disp, :]
        nT = self.lpl_phase_solution[self.n_disp:2 * self.n_disp, :]
        exc_state_S = np.dot(self.kST_weights, nS)[:, None]
        exc_state_T = np.dot(self.kST_weights, nT)[:, None]
        self.pair_conc = np.trapezoid(self.lpl_phase_solution[2 * self.n_disp:, :], self.Es, axis=0)[:, None]

        amp_S = params['amp_S'].value
        amp_T = params['amp_T'].value
        self.matrix_opt = amp_S * exc_state_S + amp_T * exc_state_T
