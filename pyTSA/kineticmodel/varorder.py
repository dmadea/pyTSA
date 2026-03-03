from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..dataset import Dataset

from .kineticmodel import BaseKineticModel
from ..mathfuncs import second_oder, mixed1st2nd_oder, varorder, fold_exp

from lmfit import Parameters
import numpy as np


class VarOrderBaseModel(BaseKineticModel):

    def __init__(self, dataset: Dataset | None = None, n_species: int = 1, set_model: bool = False):
        super(VarOrderBaseModel, self).__init__(dataset, n_species, set_model)
        self._calculate_EAS = False

    def init_params(self) -> Parameters:
        params = super(VarOrderBaseModel, self).init_params()

        params.add(f'c0', value=1, min=0, max=np.inf, vary=False)

        return params
    
    def get_rates(self):
        raise NotImplementedError()
    
    def get_labels(self, t_unit='ps'):
        alph = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        return alph[:self.n_species - 1] + ['inf']
    
    def get_decay(self, tt: np.ndarray, rates: np.ndarray, params: Parameters | None = None):
        raise NotImplementedError()
    
    def calculate_C_profiles(self, params: Parameters | None = None, times: np.ndarray | None = None):
        """

        Now it will work only for 2 species.
        
        """

        params = params if params is not None else self.params

        tt, _ks, _tau = self.get_C_profiles_args(params, times)

        if self.n_species == 0:
            return
        
        c0 = params['c0'].value 

        decay = self.get_decay(tt, _ks, params)

        if self.n_species == 1:
            self.C_opt = decay
        elif self.n_species > 1:
            self.C_opt = np.empty((tt.shape[0], 2)) if tt.ndim == 2 else np.empty((tt.shape[0], tt.shape[1], 2))
            self.C_opt[..., 0] = decay.squeeze()
            self.C_opt[..., 1] = c0 - decay.squeeze()


class FirstSecondOrderModel(VarOrderBaseModel):

    """
    Cannot handle IRF. Has to be simulated without any IRF.
    k_1 is the first order rate and k_11 is the second order rate constant.
    Works only for two species.
    """

    name = "First and Second order model"


    def init_params(self) -> Parameters:
        params = super(FirstSecondOrderModel, self).init_params()
        params.add(f'k_1', value=1, min=0, max=np.inf, vary=True)
        params.add(f'k_11', value=0.5, min=0, max=np.inf, vary=True)
        return params

    def get_rates(self, params: Parameters | None = None) -> np.ndarray:
        if (self.n_species == 0):
            return np.asarray([])
        
        params = self.params if params is None else params

        vals = np.asarray([params['k_1'].value, params['k_11'].value])

        return vals
    
    def get_labels(self, t_unit='ps'):
        labels = super(FirstSecondOrderModel, self).get_labels(t_unit)
        labels[0] = f"$k_1 = {self.params['k_1'].value:.3g}$\n$k_{{11}}={self.params['k_11'].value:.3g}$"
        labels[1] = 'inf'
        return labels
    
    def get_decay(self, tt, rates, params = None):
        k1, k11 = rates.squeeze()
        c0 = params['c0'].value
        return mixed1st2nd_oder(tt, k1, k11, c0)
    

class VarOrderModel(VarOrderBaseModel):

    """
    Cannot handle IRF. Has to be simulated without any IRF.
    """

    name = "Variable order model"


    def init_params(self) -> Parameters:
        params = super(VarOrderModel, self).init_params()
        params.add('k', value=0.1, min=0, max=np.inf, vary=True)
        params.add('n', value=2, min=0.5, max=10, vary=True)
        return params
    
    def get_labels(self, t_unit='ps'):
        labels = super(VarOrderModel, self).get_labels(t_unit)
        labels[0] = f"$k={self.params['k'].value:.3g}$\n$n={self.params['n'].value:.3g}$"
        labels[1] = 'inf'
        return labels

    def get_rates(self, params: Parameters | None = None) -> np.ndarray:
        if (self.n_species == 0):
            return np.asarray([])
        
        params = self.params if params is None else params

        vals = np.asarray([params['k'].value])

        return vals
    
    def get_decay(self, tt, rates, params = None):
        n = params['n'].value
        kn = params['k'].value
        c0 = params['c0'].value
        if n == 1:
            return fold_exp(tt, kn, 0)
        elif n == 2:
            return second_oder(tt, kn, c0)
        else:
            return varorder(tt, kn, n, c0)
