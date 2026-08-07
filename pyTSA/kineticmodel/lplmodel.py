from __future__ import annotations
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

# import glob, os
import scipy.constants as sc
from copy import deepcopy
from dataclasses import dataclass, fields

from .kineticmodel import KineticModel

from scipy.constants import Boltzmann




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
        self.I0 = 1  # light intensity 
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

        self.ridge_alpha = 0.0001

        self.initial_state: None | Callable = None
        self.temp_fun: Callable | None = None  # takes time as argument

        super(LPLModel, self).__init__(dataset, n_species, set_model)


    def init_params(self) -> Parameters:
        params = super(LPLModel, self).init_params()

        params.add('s0', value=1e12, min=0, max=np.inf, vary=False) 
        params.add('k_sep', value=1e5, min=0, max=np.inf, vary=True) 
        params.add('k_CT_rnr', value=1e7, min=0, max=np.inf, vary=True)  

        for i in range(self.n_gaussians):
            params.add(f'rho_amp_{i}', value=1, min=0, max=np.inf, vary=True)
            params.add(f'rho_mu_{i}', value=1, min=0, max=np.inf, vary=True)
            params.add(f'rho_sigma_{i}', value=1, min=0, max=np.inf, vary=True)

        if self.add_exp_distribution:
            params.add('rho_exp_amp', value=1, min=0, max=np.inf, vary=True)
            params.add('rho_exp_lambda', value=10, min=0, max=np.inf, vary=True)


        return params

    @staticmethod
    def arrhenius(E: np.ndarray, T: np.ndarray) -> np.ndarray:
        """Boltzmann factor exp(-E / kB*T); E in eV, T in K."""
        return np.exp(-E / (Boltzmann * T))

    @staticmethod
    def gaussian(Es: np.ndarray, mu: float, sigma: float) -> np.ndarray:
        return np.exp(-(Es - mu)**2 / (2 * sigma**2)) / (sigma * np.sqrt(2 * np.pi))

    @staticmethod
    def trapezoid_weights(xs: np.ndarray) -> np.ndarray:
        w = np.full(len(xs), xs[1] - xs[0])
        w[0] /= 2
        w[-1] /= 2
        return w

    def build_saturable_rhs_jac(self, params: Parameters, T_fun: Callable, I_fun: Callable):
        """RHS and analytic Jacobian of the arrowhead system with a
        *saturable* trapping term (Pauli blocking).

        T_fun(t), I_fun(t): temperature and generation-rate protocols, which
        lets the same system serve isothermal charging, LPL decay, and TL ramps.
        """

        Es = np.linspace(0.01, self.E_max, self.n_E)  # energy levels for the gaussian distribution
        self.Es = Es

        # simulate the current distribution of trap depths
        rho_0 = np.zeros(self.n_E)
        for i in range(self.n_gaussians):
            rho_0 += params[f'rho_amp_{i}'].value * self.gaussian(Es, params[f'rho_mu_{i}'].value, params[f'rho_sigma_{i}'].value)
        if self.add_exp_distribution:
            rho_0 += params['rho_exp_amp'].value * np.exp(-Es / params['rho_exp_lambda'].value)

        NE = len(Es)
        idx = np.arange(1, NE + 1)
        N_tot = np.trapezoid(rho_0, Es)
        w_E = self.trapezoid_weights(Es)

        s0 = params['s0'].value
        k_sep = params['k_sep'].value
        k_rnr = params['k_CT_rnr'].value

        def rhs(t, u):
            kE = s0 * self.arrhenius(Es, T_fun(t))
            nS, rho = u[0], u[1:]
            q = np.maximum(rho_0 - rho, 0.0) / N_tot  # vacant fraction density; int q in [0, 1]
            capture = k_sep * nS * q
            dn = I_fun(t) - k_rnr * nS - np.sum(w_E * capture) + np.sum(w_E * kE * rho)
            return np.concatenate(([dn], capture - kE * rho))

        def jac(t, u):
            kE = s0 * self.arrhenius(Es, T_fun(t))
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

    def simulate(self, params: Parameters | None = None) -> np.ndarray:


        params = self.params if params is None else params

        if self.initial_state is None:
            u0 = np.zeros(self.n_E + 1)
        else:
            u0 = self.initial_state()

        ivp_kw = dict(method="LSODA", rtol=1e-10, atol=1e-16, first_step=1e-14)

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
            raise RuntimeError(f"decay integration failed: {sol_dec.message}")

        self.accum_phase_solution = sol_acc.y
        self.lpl_phase_solution = sol_dec.y



        








    




