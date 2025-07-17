from typing import Generator, Union
from matplotlib import gridspec
from .plot import plot_data_ax, plot_data_one_dim_ax, plot_spectra_ax
from .dataset import Dataset
from .kineticmodel import KineticModel , FirstOrderModel

from lmfit import Parameters, Minimizer
from lmfit.minimizer import MinimizerResult

import numpy as np
import matplotlib.pyplot as plt
import os
import pandas as pd
from itertools import chain
from typing import Callable

from copy import deepcopy
# dataset dict  {dataset=, key=}
    
class Datasets(object):

    def __init__(self):
        self._datasets: list[dict[Dataset, int | str]] = []
        self.df_params = None
        self.model: KineticModel = FirstOrderModel()

        # for augmented model

        self.minimizer: Minimizer | None = None
        self.aug_fit_result: MinimizerResult | None = None
        # fitter arguments to the underlying fitting algorithm
        self.fitter_kwds = dict(ftol=1e-10, xtol=1e-10, gtol=1e-10, loss='linear', verbose=2, jac='3-point')

        self.fit_algorithm = "least_squares"  # trust reagion reflective alg.

    def set_model(self, model: KineticModel, index: int | None = None, key: int | str | None = None):
        if key is not None:
            dct = list(filter(lambda d: d['key'] == key, self._datasets))[0]
            dct['dataset'].model = model
            return
        
        if index is not None:
            self._datasets[index]['dataset'].model = model

        self.model = model
        self[0].set_model(model)

    def __copy__(self):
        ds = Datasets()
        ds.fitter_kwds = deepcopy(self.fitter_kwds)
        ds.fit_algorithm = deepcopy(self.fit_algorithm)
        ds._datasets = deepcopy(self._datasets)
        return ds

    def __getitem__(self, key: int | slice | list[int]) -> Dataset | list[Dataset]:
        # with deep copy
        # if isinstance(key, slice):
        #     ds = Datasets()
        #     ds.fitter_kwds = deepcopy(self.fitter_kwds)
        #     ds.fit_algorithm = deepcopy(self.fit_algorithm)
        #     ds._datasets = deepcopy(self._datasets[key])
        #     return ds
        
        if isinstance(key, slice):
            ds = Datasets()
            ds.fitter_kwds = deepcopy(self.fitter_kwds)
            ds.fit_algorithm = deepcopy(self.fit_algorithm)
            ds._datasets = self._datasets[key]  # use only ref
            return ds
        
        elif isinstance(key, list):
            assert isinstance(key[0], int)
            ds = Datasets()
            ds.fitter_kwds = deepcopy(self.fitter_kwds)
            ds.fit_algorithm = deepcopy(self.fit_algorithm)
            ds._datasets = [self._datasets[i] for i in key]  # use only ref
            return ds

        elif isinstance(key, (int, np.int64, np.int32, np.int16, np.int8)):  # returns only Dataset
            return self._datasets[key]['dataset']
        else:
            raise TypeError("Invalid input")

    
    def __setitem__(self, key: int, newvalue: Dataset): 

        if not isinstance(newvalue, Dataset):
            raise ValueError("Only Dataset type must be assigned to datasets.")
        
        self._datasets[key]['dataset'] = newvalue

    def length(self):
        return len(self._datasets)
    
    def clear(self):
        self._datasets.clear()

    def append(self, dataset: Dataset, key: str | int | None = None):
        self._datasets.append(dict(dataset=dataset, key=len(self._datasets) if key is None else key))

    def extend(self, datasets: Union[list["Dataset"], "Datasets"], keys: Union[list[str | int], None] = None):
        # Allow extending with another Datasets instance
        if isinstance(datasets, Datasets):
            datasets_list = [d for d in datasets]
        else:
            datasets_list = datasets

        n = len(datasets_list)
        if keys is not None:
            assert len(keys) == n
        else:
            keys = list(range(len(self._datasets), n + len(self._datasets)))

        self._datasets.extend([dict(dataset=d, key=key) for d, key in zip(datasets_list, keys)])

    def __add__(self, other):
        # TODO fix key assignment
        if isinstance(other, Datasets):
            new_items = self._datasets + other._datasets
        elif isinstance(other, list):
            new_items = self._datasets + other
        elif isinstance(other, Dataset):
            new_items = self._datasets + [other]
        else:
            return NotImplemented
        return Datasets(new_items)

    def __iadd__(self, other):
        if isinstance(other, Datasets):
            self._datasets.extend(other._datasets)
        elif isinstance(other, list):
            self._datasets.extend(other)
        elif isinstance(other, Dataset):
            self._datasets.append(other)
        else:
            return NotImplemented
        return self

    def remove(self, index: int | None = None, key: int | str | None = None):
        if key is not None:
            self._datasets = list(filter(lambda d: d['key'] != key, self._datasets))
            return
        
        if index is not None:
            self._datasets.pop(index)

    def __iter__(self) -> Generator[Dataset, None, None]:
        for d in map(lambda d: d['dataset'], self._datasets):
            yield d

    def __repr__(self) -> str:
        return ",\n".join([f"[Dataset=\"{dct['dataset'].name}\", key={dct['key']}]" for dct in self._datasets])

    @classmethod
    def from_filenames(cls, filenames: list[str], transpose = False, **kwargs):
        """kwargs are passed to np.getnfromtxt"""

        ds = cls()
        ds._datasets = [dict(dataset=Dataset.from_file(fname, transpose, **kwargs), key=i) for i, fname in enumerate(filenames)]
        return ds

    def crop(self, t0=None, t1=None, w0=None, w1=None):
        for d in self:
            d.crop(t0, t1, w0, w1)

    def crop_idxs(self, t0=None, t1=None, w0=None, w1=None):
        for d in self:
            d.crop_idxs(t0, t1, w0, w1)

    def baseline_correct(self, t0=0, t1=200):
        for d in self:
            d.baseline_correct(t0, t1)

    def baseline_drift_correct(self, w0=0, w1=300):
        for d in self:
            d.baseline_drift_correct(w0, w1)

    def transpose(self):
        for d in self:
            d.transpose()

    def dimension_multiply(self, x: float = 1.0, y: float = 1.0, z: float = 1.0):
        for d in self:
            d.dimension_multiply(x, y, z)

    def set_t0_as(self, t0=0):
        for d in self:
            d.times -= d.times[0] + t0

    def get_averaged_dataset(self, apply_mask: bool = True) -> Dataset:
        if len(self._datasets) == 0:
            raise ValueError("No datasets.")
        
        if len(self._datasets) == 1:
            return self[0]
        
        mats2avrg = []
        
        for d in self:
            if d is None:
                continue
            m = d.matrix_fac.copy()
            if apply_mask:
                d.apply_mask(m)
            mats2avrg.append(m)

        m_stacked = np.stack(mats2avrg, axis=2)
        m_avrg = np.nanmean(m_stacked, axis=2, keepdims=False)
        # m_avrg = mats.mean(axis=2)

        return Dataset(m_avrg, self[0].times, self[0].wavelengths, name=f"{self[0].name}-avrg")


    def get_combined_dataset(self, axis=0) -> Dataset | None:
        if len(self._datasets) == 0:
            raise ValueError("No datasets.")
        
        times = np.hstack(list(map(lambda d: d.times, iter(self)))) if axis == 0 else self[0].times
        wavelengths = np.hstack(list(map(lambda d: d.wavelengths, self._datasets))) if axis == 1 else self[0].wavelengths

        if axis == 0:
            mat = np.vstack(list(map(lambda d: d.matrix, iter(self))))
        else:
            mat = np.hstack(list(map(lambda d: d.matrix, iter(self))))

        return Dataset(mat, times, wavelengths, name=self[0].name)
    
    def plot_spectra(self, filepath=None, **kwargs):
        n = len(self._datasets)
        if n == 0:
            return
        
        ncols = int(np.floor(n ** 0.5))
        nrows = int(np.ceil(n / ncols))
        fig, axes = plt.subplots(nrows, ncols, figsize=kwargs.get('figsize', (5.5 * ncols, 4.5 * nrows)))
        if nrows * ncols == 1:
            axes = np.asarray([axes])

        for d, ax in zip(iter(self), axes.flatten()):
            _kwargs = kwargs.copy()
            title = _kwargs.pop('title', d.name)

            plot_spectra_ax(ax, d.matrix, d.times, d.wavelengths, title=title, **_kwargs)

        plt.tight_layout()

        if filepath:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, transparent=kwargs.get('transparent', True), dpi=kwargs.get('dpi', 300))
        else:
            plt.show()
    
    def plot_data(self, filepath=None, **kwargs):
        n = len(self._datasets)
        if n == 0:
            return
        
        ncols = int(np.floor(n ** 0.5))
        nrows = int(np.ceil(n / ncols))
        fig, axes = plt.subplots(nrows, ncols, figsize=kwargs.get('figsize', (5.5 * ncols, 4.5 * nrows)))
        if nrows * ncols == 1:
            axes = np.asarray([axes])

        for d, ax in zip(iter(self), axes.flatten()):
            _kwargs = kwargs.copy()
            title = _kwargs.pop('title', d.name)

            if d.matrix_fac.shape[1] == 1:
                plot_data_one_dim_ax(ax, d.times, d.matrix[:, 0], title=title, **_kwargs)
            else:
                plot_data_ax(fig, ax, d.matrix, d.times, d.wavelengths, title=title, **_kwargs)

        plt.tight_layout()

        if filepath:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, transparent=kwargs.get('transparent', True), dpi=kwargs.get('dpi', 300))
        else:
            plt.show()

    def get_integrated_datasets(self):
        ids = Datasets()

        for d in iter(self):
            ids.append(d.get_integrated_dataset())

        return ids


    def plot_models(self, *what, outer_nrows: int | None = None, outer_ncols: int | None = None, fig_labels_offset=0,
                    inner_nrows: int | None = None, inner_ncols: int | None = None, outer_hspace=0.2, outer_wspace=0.2,
                    inner_hspace=0.2, inner_wspace=0.2, X_SIZE=5.5, Y_SIZE=4.5, filepath=None, transparent=True, dpi=300, **kwargs):
        
        n_outer = self.length()
        if n_outer == 0:
            return
        
        if outer_nrows is None and outer_ncols is None:
            outer_ncols = int(np.floor(n_outer ** 0.5))
            outer_nrows = int(np.ceil(n_outer / outer_ncols))
        elif outer_nrows is not None and outer_ncols is None:
            outer_ncols = int(np.ceil(n_outer / outer_nrows))
        elif outer_nrows is None and outer_ncols is not None:
            outer_nrows = int(np.ceil(n_outer / outer_ncols))

        n_inner = len(what)
        if n_inner == 0:
            return
        
        if inner_nrows is None and inner_ncols is None:
            inner_ncols = int(np.floor(n_inner ** 0.5))
            inner_nrows = int(np.ceil(n_inner / inner_ncols))
        elif inner_nrows is not None and inner_ncols is None:
            inner_ncols = int(np.ceil(n_inner / inner_nrows))
        elif inner_nrows is None and inner_ncols is not None:
            inner_nrows = int(np.ceil(n_inner / inner_ncols))

        fig = plt.figure(figsize=kwargs.get('figsize', (X_SIZE * outer_ncols * inner_ncols, Y_SIZE * inner_nrows * outer_nrows)))

        outer_grid = gridspec.GridSpec(outer_nrows, outer_ncols, figure=fig, wspace=outer_wspace, hspace=outer_hspace)

        def get_dataset_specific_kwargs(prefix: str, kwargs: dict):
            kws = kwargs.copy()
            for key, value in kwargs.items():
                if key.startswith(prefix.lower()):
                    _key = key[len(prefix) + 1:]  # to account for _ symbol, e.g. d1_eas_y_lim -> eas_y_lim
                    kws[_key] = value
            return kws

        for i, gs in enumerate(outer_grid):
            if i >= self.length():
                break

            assert self[i].model is not None
            _offset = i*n_inner + fig_labels_offset

            kws = get_dataset_specific_kwargs(f"d{i}", kwargs)  # rewrite dataset-specific kwargs

            self[i].model._plot_gs(fig, gs, what, inner_nrows, inner_ncols, inner_hspace, inner_wspace, fig_labels_offset=_offset, **kws)

        if filepath:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, bbox_inches='tight', transparent=transparent, dpi=dpi)
        else:
            plt.show()


    def extract_params_from_models(self, param_names: list[str] | None = None, use_unfixed_params=True,
                                   include_stderr=False, include_relative_error=True) -> pd.DataFrame:

        assert self.length() > 0
        assert self[0].model is not None

        if param_names is None: 
            param_names = self[0].model.params.keys()
            if use_unfixed_params:
                param_names = list(filter(lambda pn: self[0].model.params[pn].vary, param_names))

        columns = ["Name"]
        for pn in param_names:
            columns.append(pn)
            if include_stderr:
                columns.append(f"{pn}_stderr")

            if include_relative_error:
                columns.append(f"{pn}_rel_err (%)")

        self.df_params = pd.DataFrame(columns=columns)
        # print(columns)

        for dataset in iter(self):
            assert dataset.model is not None
            params = dataset.model.fit_result.params if dataset.model.fit_result is not None else  dataset.model.params
            values = [dataset.name]
            for pn in param_names:
                values.append(params[pn].value)
                if include_stderr:
                    values.append(params[pn].stderr)

                if include_relative_error:
                    values.append(np.abs(params[pn].stderr * 100 / params[pn].value) if params[pn].value != 0 else 0)

            # print(values)
            self.df_params.loc[len(self.df_params)] = values

        return self.df_params


    def fit_augmented(self, global_params: Parameters | None = None, global_param_names: list[str] | None = None,
                      group_params: dict[str,tuple[tuple[int]]] = {}) -> MinimizerResult:
        """
            group params argument defines the parameters that will be kept the same within specified group of datasets

            example: there are total of 6 datasets but only in total 3 params par1 will be fitted
            first will be shared with first two datasets, second with another two, etc.

            group_params = {
                'par1': ((0, 1), (2, 3), (4, 5))
            }
        """
        for d in self.__iter__():
            if d.model is None:
                raise ValueError("Each dataset needs to have assigned model")
            
        aug_params = Parameters() if global_params is None else global_params

        # fill the global params from model
        # assuming the global params are present in first model of dataset
        if global_params is None:
            assert global_param_names is not None, "global_param_names cannot be None"
            pars = self[0].model.params

            for n in global_param_names:
                if n in pars.keys():
                    aug_params.add(n, value=pars[n].value, vary=pars[n].vary, min=pars[n].min, max=pars[n].max)

        global_param_names = list(aug_params.keys())
        group_param_names = group_params.keys()
        group_params_indexes = {name: list(chain.from_iterable(group)) for name, group in group_params.items()}

        get_group_name: Callable[[str, tuple[int]], str] = lambda par_name, indexes: f"{par_name}_{"".join([str(idx) for idx in indexes])}"
        get_par_name: Callable[[str, int], str] = lambda par_name, index: f"{par_name}_{index}"

        ## fill group params, change the names accordingnly to unique names
        for g_par_name, group in group_params.items():
            for indexes in group:  # ((0, 1), (2, 3), (4, 5))
                assert len(indexes) > 1, "at least 2 datasets must be used for group param"

                # use parameter corresponding to the first index in the index group
                par = self[indexes[0]].model.params[g_par_name]

                # suffix = "".join([str(idx) for idx in indexes])
                aug_params.add(get_group_name(g_par_name, indexes), value=par.value, vary=par.vary, min=par.min, max=par.max)

        # fill in all the params from models and change the name of them according to their index
        for i, d in enumerate(self.__iter__()):
            for name, par in d.model.params.items():
                if name in global_param_names:
                    continue

                if name in group_param_names:
                    if i in group_params_indexes[name]:
                        continue

                aug_params.add(get_par_name(name, i), value=par.value, vary=par.vary, min=par.min, max=par.max)

        def fill_params2models(params):
            # update all parameter values and simulate every model
            for i, d in enumerate(self.__iter__()):
                for name, par in d.model.params.items():
                    # assign the global parameter value
                    if name in global_param_names:
                        try:
                            par.value = params[name].value
                            par.stderr = params[name].stderr
                        except KeyError:
                            pass
                        continue

                    if name in group_param_names and i in group_params_indexes[name]:
                        # find the group
                        idx_group = None
                        for indexes in group_params[name]:  # ((0, 1), (2, 3), (4, 5))
                            if i in indexes:
                                idx_group = indexes
                                break
                        else:
                            raise ValueError("Group param was not found")
                        _name = get_group_name(name, idx_group)
                    else:
                        _name = get_par_name(name, i)
                    
                    # assign param
                    par.value = params[_name].value
                    par.stderr = params[_name].stderr

        def residuals(params):

            res_list = []

            fill_params2models(params)

            # update all parameter values and simulate every model
            for d in self.__iter__():
                d.model.simulate()
                res_list.append(d.model.weighted_residuals())

            # find common dimension, and concatenate, if no common dimension, concatenate flat arrays
            # axis_0_shapes = np.asarray([m.shape[0] for m in res_list])
            # axis_1_shapes = np.asarray([m.shape[1] for m in res_list])

            # axis_0_same = np.all(axis_0_shapes == axis_0_shapes[0])
            # axis_1_same = np.all(axis_1_shapes == axis_1_shapes[0])

            # if axis_0_same:
            #     return np.concatenate(res_list, axis=1)

            # if axis_1_same:
            #     return np.concatenate(res_list, axis=0)
            
            # flat stack arrays
            return np.concatenate([ar.flat for ar in res_list], axis=0)


        self.minimizer = Minimizer(residuals, aug_params, nan_policy='omit')
        self.aug_fit_result = self.minimizer.minimize(method=self.fit_algorithm, **self.fitter_kwds)  # minimize the residuals

        fill_params2models(self.aug_fit_result.params)

        return self.aug_fit_result


