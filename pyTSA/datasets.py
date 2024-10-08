
from .plot import plot_data_ax
from .dataset import Dataset
from .kineticmodel import KineticModel, FirstOrderModel

import numpy as np
import matplotlib.pyplot as plt
import os

    
class Datasets(object):

    def __init__(self):
        self._datasets: list[dict[Dataset, int | str]] = []
        self.model: KineticModel = FirstOrderModel()

    def set_model(self, model: KineticModel):
        self.model = model
        if self.length() > 0:
            self.model.dataset = self[0]

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

    def remove(self, index: int | None = None, key: int | str | None = None):
        if key is not None:
            self._datasets = list(filter(lambda d: d['key'] != key, self._datasets))
            return
        
        if index is not None:
            self._datasets.pop(index)

    def __iter__(self):
        for d in map(lambda d: d['dataset'], self._datasets):
            yield d

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

    def get_averaged_dataset(self) -> Dataset:
        pass

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
    
    def plot(self, filepath=None, **kwargs):
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

