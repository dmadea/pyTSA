
from plot import plot_data_ax
from dataset import Dataset
import numpy as np
import matplotlib.pyplot as plt
import os

    
class Datasets(object):

    def __init__(self):
        self._datasets: list[Dataset] = []

    def __getitem__(self, key: int):
        return self._datasets[key]
    
    def __setitem__(self, key: int, newvalue: Dataset): 

        if not isinstance(newvalue, Dataset):
            raise ValueError("Only Dataset type must be assigned to datasets.")
        
        self._datasets[key] = newvalue

    def length(self):
        return len(self._datasets)

    def append(self, dataset: Dataset):
        self._datasets.append(dataset)

    def __iter__(self):
        for d in self._datasets:
            yield d

    @classmethod
    def from_filenames(cls, filenames: list[str], transpose = False, **kwargs):
        """kwargs are passed to np.getnfromtxt"""

        ds = cls()
        ds._datasets = [Dataset.from_file(fname, transpose, **kwargs) for fname in filenames]
        return ds

    def crop(self, t0=None, t1=None, w0=None, w1=None):
        for d in self:
            d.crop(t0, t1, w0, w1)

    def baseline_correct(self, t0=0, t1=200):
        for d in self:
            d.baseline_correct(t0, t1)

    def transpose(self):
        for d in self:
            d.transpose()

    def dimension_multiply(self, times_factor: float = 1.0, wavelengths_factor: float = 1.0):
        for d in self:
            d.dimension_multiply(times_factor, wavelengths_factor)

    def get_averaged_dataset(self) -> Dataset:
        pass

    def get_combined_dataset(self, axis=0) -> Dataset | None:
        if len(self._datasets) == 0:
            raise ValueError("No datasets.")
        
        times = np.hstack(list(map(lambda d: d.times, self._datasets))) if axis == 0 else self[0].times
        wavelengths = np.hstack(list(map(lambda d: d.wavelengths, self._datasets))) if axis == 1 else self[0].wavelengths

        if axis == 0:
            mat = np.vstack(list(map(lambda d: d.matrix, self._datasets)))
        else:
            mat = np.hstack(list(map(lambda d: d.matrix, self._datasets)))

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

        for d, ax in zip(self._datasets, axes.flatten()):
            plot_data_ax(fig, ax, d.matrix, d.times, d.wavelengths, title=d.name, **kwargs)

        plt.tight_layout()

        if filepath:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, transparent=kwargs.get('transparent', True), dpi=kwargs.get('dpi', 300))
        else:
            plt.show()

