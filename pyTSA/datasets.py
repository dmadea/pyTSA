
from matplotlib import gridspec
from .plot import plot_data_ax
from .dataset import Dataset
from .kineticmodel import KineticModel , FirstOrderModel

import numpy as np
import matplotlib.pyplot as plt
import os
import pandas as pd

# dataset dict  {dataset=, key=}
    
class Datasets(object):

    def __init__(self):
        self._datasets: list[dict[Dataset, int | str]] = []
        self.df_params = None
        self.model: KineticModel = FirstOrderModel()

    def set_model(self, model: KineticModel, index: int | None = None, key: int | str | None = None):
        if key is not None:
            dct = list(filter(lambda d: d['key'] == key, self._datasets))[0]
            dct['dataset'].model = model
            return
        
        if index is not None:
            self._datasets[index]['dataset'].model = model

        self.model = model
        self[0].set_model(model)


    def __getitem__(self, key: int) -> Dataset:
        return self._datasets[key]['dataset']
    
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

    def extend(self, datasets: list[Dataset], keys: list[str | int] | None = None):
        n = len(datasets)
        if keys is not None:
            assert len(keys) == n
        else:
            keys = list(range(len(self._datasets), n + len(self._datasets)))

        self._datasets.extend([dict(dataset=d, key=key) for d, key in zip(datasets, keys)])

    def remove(self, index: int | None = None, key: int | str | None = None):
        if key is not None:
            self._datasets = list(filter(lambda d: d['key'] != key, self._datasets))
            return
        
        if index is not None:
            self._datasets.pop(index)

    def __iter__(self):
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

    def get_averaged_dataset(self) -> Dataset:
        if len(self._datasets) == 0:
            raise ValueError("No datasets.")
        
        if len(self._datasets) == 1:
            return self[0]

        mats = np.stack([d.matrix for d in self], axis=2)
        m_avrg = mats.mean(axis=2)

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
            plot_data_ax(fig, ax, d.matrix, d.times, d.wavelengths, title=d.name, **kwargs)

        plt.tight_layout()

        if filepath:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, transparent=kwargs.get('transparent', True), dpi=kwargs.get('dpi', 300))
        else:
            plt.show()

    def plot_models(self, *what, outer_nrows: int | None = None, outer_ncols: int | None = None, 
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

        for i, gs in enumerate(outer_grid):
            if i >= self.length():
                break

            assert self[i].model is not None
            self[i].model._plot_gs(fig, gs, what, inner_nrows, inner_ncols, inner_hspace, inner_wspace, **kwargs)

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
            params = dataset.model.fit_result.params
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






