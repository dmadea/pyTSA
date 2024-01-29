
import numpy as np
from scipy.linalg import svd

import os
import matplotlib.pyplot as plt
from matplotlib.ticker import *
from matplotlib import cm

from sklearn.decomposition import NMF
from sklearn.decomposition import FastICA
from numpy import ma


from .kineticmodel import FirstOrderModel, KineticModel
from .mathfuncs import crop_data, fi, chirp_correction
from .plot import plot_data_ax, plot_SADS_ax, plot_spectra_ax, plot_traces_onefig_ax, dA_unit, MinorSymLogLocator, plot_kinetics_ax


class Dataset(object):

    @classmethod
    def from_value_matrix(cls, value_matrix, times, wavelengths, filename='', name='', mask=[]):
        m = cls()
        m.matrix = value_matrix
        m.times = times
        m.wavelengths = wavelengths
        m.filepath = filename
        m.name = name
        m.mask = mask
        m.SVD()
        m._set_D()
        return m

    @property
    def Mask(self):
        return self._mask

    @Mask.setter
    def Mask(self, value):  # true or false
        self._mask = value
        self._set_D()

    @property
    def SVD_filter(self):
        return self._SVD_filter

    @SVD_filter.setter
    def SVD_filter(self, value):  # true or false
        self._SVD_filter = value
        self._set_D()

    @property
    def ICA_filter(self):
        return self._ICA_filter

    @ICA_filter.setter
    def ICA_filter(self, value):  # true or false
        self._ICA_filter = value
        self._set_D()

    def _set_D(self):
        self.matrix_fac = self.matrix
        # if self.Yr is None:
        #     self.Yr = self.matrix
        # self.matrix_fac = self.matrix.copy() if self._SVD_filter else self.matrix.copy()
        # if self._ICA_filter:
        #     self.matrix_fac -= self.ICA_subtr_mat
        # if self._mask:
        #     self.apply_mask(self.matrix_fac)

    def update_D(self):
        self._set_D()

    def get_factored_matrix(self):
        """Returns the current/factored matrix as a LFP_Matrix object."""

        if self._mask:
            self.Mask = False

        m = Dataset.from_value_matrix(self.matrix_fac.copy(), self.times.copy(), self.wavelengths.copy(),
                                         filename=self.filepath,
                                         name=self.name, mask=self.mask.copy())
        return m
    
    @classmethod
    def from_file(cls, fname: str, transpose: bool = False, **kwargs):
        data = np.genfromtxt(fname, dtype=np.float64, filling_values=np.nan,  **kwargs)

        t = data[1:, 0]
        w = data[0, 1:]
        mat = data[1:, 1:]

        if transpose:
            [t, w] = [w, t]
            mat = mat.T

        return cls(mat, t, w, filepath=fname)

    def copy(self):
        return Dataset(self.matrix.copy(), self.times.copy(), self.wavelengths.copy(), filepath=self.filepath, name=self.name)

    def __init__(self, matrix: np.ndarray, times: np.ndarray, wavelengths: np.ndarray,
                 filepath: str | None = None, name: str | None = None):

        assert matrix.shape[0] == times.shape[0] and matrix.shape[1] == wavelengths.shape[0]

        # define original data matrix
        self.matrix_o: np.ndarray = matrix
        self.times_o: np.ndarray = times
        self.wavelengths_o: np.ndarray = wavelengths

        # actual data matrix whose dimensions can be different
        self.wavelengths: np.ndarray = self.wavelengths_o.copy()  # dim = w
        self.times: np.ndarray = self.times_o.copy()  # dim = t
        self.matrix: np.ndarray = self.matrix_o.copy()  # dim = t x w   # original data
        self.matrix_fac: np.ndarray = self.matrix   # factored matrix

        # model and fitter
        self.model: KineticModel | None = None

        # svd matrices k = min(t, w)
        self.U: np.ndarray | None = None  # dim = (t x k)
        self.S: np.ndarray | None = None  # !! this is only 1D array of singular values, not diagonal matrix
        self.V_T: np.ndarray | None = None  # dim = (k x w)

        # define chirp-corrected dataset
        self.chirp_corrected_dataset: Dataset | None = None

        self.filepath: str = filepath
        if name is None and self.filepath is not None:
            tail = os.path.split(self.filepath)[1]
            self.name = os.path.splitext(tail)[0]  # without extension
        else:
            self.name = name

        # self._SVD_filter = False
        # self._ICA_filter = False
        # self._mask = False
        # self.ICA_components = 5

        # self.C_ICA = None
        # self.ST_ICA = None

        # reduced svd matrices, nr is number of taken singular values, cca 1 to 10 max
        # self.Ur = None  # dim = (t x nr)
        # self.Sr = None  # !! this is diagonal matrix - dim = (nr x nr)
        # self.V_Tr = None  # dim = (nr x w)

        # n is number of actual absorbing species our model is based on
        # we are looking for C and A so it satisfy condition Y = C @ A

        # self.UrSr = None  # Ur @ Sr

        # self.Yr = self.matrix  # reconstructed data matrix after data reduction from SVD
        # self.ICA_subtr_mat = 0  # matrix for subtraction after ICA comp. removal

        self.mask = []

        self.SVD()

    def set_model(self, model: KineticModel):
        if not isinstance(model, KineticModel):
            raise TypeError("Model needst to be type of KineticModel.")
        
        self.model = model
        self.model.dataset = self

    def fit(self):
        if self.model is None:
            raise TypeError("Datasets needs to have a valid model instantiated.")

        self.fitter.var_pro_femto()
        

    # def get_filename(self) -> str | None:
    #     if not self.filepath:
    #         return None
        
    #     tail = os.path.split(self.filepath)[1]
    #     return os.path.splitext(tail)[0]  # without extension

    def add_masked_area(self, t0=None, t1=None, w0=None, w1=None):

        t0_idx = fi(self.times, t0) if t0 is not None else 0
        t1_idx = fi(self.times, t1) + 1 if t1 is not None else self.matrix.shape[0]

        w0_idx = fi(self.wavelengths, w0) if w0 is not None else 0
        w1_idx = fi(self.wavelengths, w1) + 1 if w1 is not None else self.matrix.shape[1]

        self.mask.append([t0_idx, t1_idx, w0_idx, w1_idx])

    def clear_mask(self):
        self.mask.clear()

    def apply_mask(self, matrix):
        if len(self.mask) == 0:
            return

        assert matrix.shape[0] == self.times.shape[0] and matrix.shape[1] == self.wavelengths.shape[0]

        for (t0_idx, t1_idx, w0_idx, w1_idx) in self.mask:
            matrix[t0_idx:t1_idx, w0_idx:w1_idx] = np.nan

    def SVD(self):
        self.U, self.S, self.V_T = svd(self.matrix, full_matrices=False, lapack_driver='gesdd')
        # self.run_ICA()

    def save_fit(self, filepath, ST=None, C=None):

        if self.C_fit is None:
            return

        D_fit = self.C_fit @ self.ST_fit

        # wavelengths = np.concatenate([[0], mw.matrix.wavelengths])

        mat = np.vstack((self.wavelengths, D_fit))

        t = np.concatenate([[0], self.times])
        mat = np.hstack((t.reshape(-1, 1), mat))

        buff_mat = Dataset.to_string(mat, separator=',')

        with open(filepath + '.csv', 'w') as f:
            f.write(buff_mat)

        if ST is None and C is None:
            ST = self.ST_fit
            C = self.C_fit

        buff_A = 'Wavelength,' + ','.join([str(i + 1) for i in range(ST.shape[0])]) + '\n'

        ST = np.vstack((self.wavelengths, ST))
        buff_A += '\n'.join(','.join(str(num) for num in row) for row in ST.T)

        with open(filepath + '-A.csv', 'w') as f:
            f.write(buff_A)

        buff_C = 'Conc,' + ','.join([str(i + 1) for i in range(C.shape[1])]) + '\n'

        C = np.hstack((self.times.reshape(-1, 1), C))
        buff_C += '\n'.join(','.join(str(num) for num in row) for row in C)

        with open(filepath + '-C.csv', 'w') as f:
            f.write(buff_C)

    def get_TWC(self, axis=1):
        return np.trapz(self.matrix, self.wavelengths, axis=axis)

    def plot_TWC(self):
        twc = self.get_TWC()

        plt.plot(self.times, twc)
        plt.xlabel("Times / min")
        plt.title('Total Wavelength Chromatogram')
        plt.tight_layout()
        plt.show()

    def save_factored_matrix(self, filepath='file.txt', delimiter='\t', encoding='utf8', t0=None, t1=None, w0=None, w1=None):

        # _, fname = os.path.split(self.filepath)
        # name, ext = os.path.splitext(fname)

        # fpath = os.path.join(output_dir, f'{name}_factored.{extension}')

        self._save_matrix(self.matrix_fac, fname=filepath, delimiter=delimiter, encoding=encoding, t0=t0, t1=t1, w0=w0, w1=w1)

    def save_matrix(self, filepath: str | None = 'file.txt', directory: str | None = None, extension: str | None = None, 
                    delimiter='\t', encoding='utf8', t0=None, t1=None, w0=None, w1=None):
        """If filepath is None and directory and extension is provided, it will use the name of the dataset and save in the directory."""

        if directory is not None and extension is not None:
            fpath = os.path.join(directory, f"{self.name}.{extension}")
        else:
            assert filepath is not None
            fpath = filepath

        # _, fname = os.path.split(self.filepath)
        # name, ext = os.path.splitext(fname)
        #
        # fpath = os.path.join(output_dir, f'{name}.{extension}')

        self._save_matrix(self.matrix, fname=fpath, delimiter=delimiter, encoding=encoding, t0=t0, t1=t1, w0=w0, w1=w1)

    def _save_matrix(self, D=None, fname='output.txt', delimiter='\t', encoding='utf8', t0=None, t1=None, w0=None, w1=None):
        # cut data if necessary

        t_idx_start = fi(self.times, t0) if t0 is not None else 0
        t_idx_end = fi(self.times, t1) + 1 if t1 is not None else self.matrix_fac.shape[0]

        wl_idx_start = fi(self.wavelengths, w0) if w0 is not None else 0
        wl_idx_end = fi(self.wavelengths, w1) + 1 if w1 is not None else self.matrix_fac.shape[1]

        D = self.matrix_fac if D is None else D

        # crop the data if necessary
        D_crop = D[t_idx_start:t_idx_end, wl_idx_start:wl_idx_end]
        times_crop = self.times[t_idx_start:t_idx_end]
        wavelengths_crop = self.wavelengths[wl_idx_start:wl_idx_end]

        mat = np.vstack((wavelengths_crop, D_crop))
        buffer = delimiter + delimiter.join(f"{num}" for num in times_crop) + '\n'
        buffer += '\n'.join(delimiter.join(f"{num}" for num in row) for row in mat.T)

        with open(fname, 'w', encoding=encoding) as f:
            f.write(buffer)


    def save_to_GTA(self, fname=None, delimiter='\t', encoding='utf8', t0=None, t1=None, w0=None, w1=None):
        _dir, _fname = os.path.split(self.filepath)   # get dir and filename
        _fname, _ = os.path.splitext(_fname)  # get filename without extension

        if fname is None:
            fname = os.path.join(_dir, f'{_fname}.ascii')

        # cut data if necessary

        t_idx_start = fi(self.times, t0) if t0 is not None else 0
        t_idx_end = fi(self.times, t1) + 1 if t1 is not None else self.matrix_fac.shape[0]

        wl_idx_start = fi(self.wavelengths, w0) if w0 is not None else 0
        wl_idx_end = fi(self.wavelengths, w1) + 1 if w1 is not None else self.matrix_fac.shape[1]

        # crop the data if necessary
        D_crop = self.matrix_fac[t_idx_start:t_idx_end, wl_idx_start:wl_idx_end]
        times_crop = self.times[t_idx_start:t_idx_end]
        wavelengths_crop = self.wavelengths[wl_idx_start:wl_idx_end]

        mat = np.vstack((wavelengths_crop, D_crop))
        buffer = f'Header\nOriginal filename: fname\nTime explicit\nintervalnr {times_crop.shape[0]}\n'
        buffer += delimiter + delimiter.join(f"{num}" for num in times_crop) + '\n'
        buffer += '\n'.join(delimiter.join(f"{num}" for num in row) for row in mat.T)

        with open(fname, 'w', encoding=encoding) as f:
            f.write(buffer)


    # non-negative matrix factorization solution
    def get_NMF_solution(self, n_components=3, random_state=0):
        model = NMF(n_components=n_components, init='random', random_state=random_state)
        _D = self.matrix.copy()
        _D[_D < 0] = 0
        C = model.fit_transform(_D)
        ST = model.components_
        return C, ST

    @staticmethod
    def _fEFA(matrix, sing_values_num=7, points=200):
        """Performs forward Evolving factor analysis over time domain on the current matrix."""

        t_idxs = np.linspace(int(matrix.shape[0] / points), matrix.shape[0] - 1, num=points).astype(int)
        sing_values = np.ones((points, sing_values_num), dtype=np.float64) * np.nan
        fEFA_VTs = np.ones((points, sing_values_num, matrix.shape[1])) * np.nan
        # self.fEFA_Us = np.ones((points, sing_values_num, self.D.shape[0])) * np.nan

        for i in range(points):
            U, S, V_T = svd(matrix[:t_idxs[i], :], full_matrices=False, lapack_driver='gesdd')
            n = int(min(sing_values_num, S.shape[0]))
            sing_values[i, :n] = S[:n]

            fEFA_VTs[i, :n] = V_T[:n, :]

        return sing_values, fEFA_VTs, t_idxs

    def fEFA(self, sing_values_num=7, points=200):
        """Performs forward Evolving factor analysis over time domain on the current matrix."""

        t_idxs = np.linspace(int(self.times.shape[0] / points), self.times.shape[0] - 1, num=points).astype(int)
        self.sing_values = np.ones((points, sing_values_num), dtype=np.float64) * np.nan
        self.fEFA_VTs = np.ones((points, sing_values_num, self.matrix_fac.shape[1])) * np.nan
        # self.fEFA_Us = np.ones((points, sing_values_num, self.D.shape[0])) * np.nan

        for i in range(points):
            U, S, V_T = svd(self.matrix_fac[:t_idxs[i], :], full_matrices=False, lapack_driver='gesdd')
            n = int(min(sing_values_num, S.shape[0]))
            self.sing_values[i, :n] = S[:n]

            self.fEFA_VTs[i, :n] = V_T[:n, :]
            # self.fEFA_Us[i, :n] = U[:, :n].T

        times = self.times[t_idxs]

        for i in range(sing_values_num):
            plt.plot(times, self.sing_values[:, i], label=f'{i+1}')
        plt.xlabel('Time / s')
        plt.ylabel('Singular value')
        plt.title('Evolving factor analysis')
        plt.yscale('log')
        plt.legend()

        plt.show()

    def fEFA_plot_VTs(self, component=1, norm=False):
        if not hasattr(self, 'fEFA_VTs'):
            return

        assert self.sing_values.shape[0] == self.fEFA_VTs.shape[0]

        n = self.sing_values.shape[0]

        cmap = cm.get_cmap('jet', n)

        for i in range(n):
            vector = self.fEFA_VTs[i, component - 1, :]
            if norm:
                vector /= vector.max()
            plt.plot(self.wavelengths, vector, label=f'SV={self.sing_values[i]}',
                     color=cmap(i), lw=0.5)
        plt.xlabel('Wavelength / nm')
        plt.ylabel('Amplitude')
        plt.title(f'{component}-th V_T vector')
        # plt.legend()

        plt.show()

    def run_ICA(self, random_state=0, max_iter=1e4):
        # pass
        ica = FastICA(n_components=self.ICA_components, random_state=random_state, max_iter=int(max_iter))

        self.C_ICA = ica.fit_transform(self.matrix)
        self.ST_ICA = ica.mixing_.T

    def set_ICA_filter(self, l_comp=(), n_components=5):
        """Subtracts components in l_comp = [0, 1, 5, ...] list/tuple."""

        if any(map(lambda item: item >= n_components, l_comp)):
            raise ValueError(f"Invalid input, l_comp cannot contain values larger than {n_components - 1}.")

        if n_components != self.ICA_components:
            self.ICA_components = n_components
            self.run_ICA()

        comps = np.zeros(n_components)
        comps[l_comp] = 1

        print(l_comp, n_components)

        self.ICA_subtr_mat = self.C_ICA @ np.diag(comps) @ self.ST_ICA  # outer product

        # update D
        self._set_D()

    def set_SVD_filter(self, l_vectors=(0,)):
        """l_vector - list of singular vector to include into the filter, numbering from 0,
        eg. [0, 1, 2, 3, 5, 6], [0], [1], etc.
        """

        Sr_plain = self.S.copy()

        # calculate the difference of sets, from https://stackoverflow.com/questions/3462143/get-difference-between-two-lists
        l_diff = list(set([i for i in range(self.S.shape[0])]) - set(l_vectors))

        # put all other singular vectors different from chosen vectors to zero
        Sr_plain[l_diff] = 0

        Sr = np.diag(Sr_plain)

        # reconstruct the data matrix, @ is a dot product
        self.Yr = self.U @ Sr @ self.V_T

        # update D
        self._set_D()

    def crop(self, t0=None, t1=None, w0=None, w1=None):

        self.matrix, self.times, self.wavelengths = crop_data(self.matrix, self.times, self.wavelengths,
                                                               t0, t1, w0, w1)
        
        a = 3

        self.SVD()
        self._set_D()

        return self

    def baseline_correct(self, t0=0, t1=200):
        """Subtracts a average of specified time range from all data.
        Deep copies the object and new averaged one is returned."""

        t_idx_start = fi(self.times, t0) if t0 is not None else 0
        t_idx_end = fi(self.times, t1) + 1 if t1 is not None else self.matrix_fac.shape[0]

        D_selection = self.matrix[t_idx_start:t_idx_end, :]
        self.matrix -= D_selection.mean(axis=0)

        self.SVD()
        self._set_D()

        return self

    def reduce(self, t_dim=None, w_dim=None):
        """Reduces the time and wavelength dimension by t_dim and w_dim, respectively.
        eg. for t_dim=10, every 10-th row of original matrix will contain reduced matrix."""

        t_factor = int(t_dim) if t_dim is not None else 1
        w_factor = int(w_dim) if w_dim is not None else 1

        self.matrix = self.matrix[::t_factor, :]
        self.times = self.times[::t_factor]

        self.matrix = self.matrix[:, ::w_factor]
        self.wavelengths = self.wavelengths[::w_factor]

        self.SVD()

        # update matrix D
        self._set_D()

        return self
    
    def dimension_multiply(self, x: float = 1.0, y: float = 1.0, z: float = 1.0):
        self.times *= y
        self.wavelengths *= x
        self.matrix *= z

    def restore_original_data(self):
        self.wavelengths = self.wavelengths_o
        self.times = self.times_o
        self.matrix = self.matrix_o
        self.SVD()
        self._set_D()


    # time_slice and wavelength_slice are np.s_ slice objects
    def slice(self, time_slice, wavelength_slice):
        self.matrix = self.matrix[time_slice, wavelength_slice]
        self.wavelengths = self.wavelengths[wavelength_slice]
        self.times = self.times[time_slice]

    def transpose(self):
        [self.times, self.wavelengths] = [self.wavelengths, self.times]
        self.matrix = self.matrix.T

        [self.times_o, self.wavelengths_o] = [self.wavelengths_o, self.times_o]
        self.matrix_o = self.matrix_o.T

        self.SVD()
        # update matrix D
        self._set_D()

    def plot(self, filepath=None, **kwargs):
        fig, ax = plt.subplots(1, 1, figsize=kwargs.get('figsize', (5.5, 4.5)))
        plot_data_ax(fig, ax, self.matrix, self.times, self.wavelengths, 
                     title=self.name, **kwargs)

        if filepath:
            ext = os.path.splitext(filepath)[1].lower()[1:]
            plt.savefig(fname=filepath, format=ext, transparent=kwargs.get('transparent', True), dpi=kwargs.get('dpi', 300))
        else:
            plt.show()


    # def plot_log_of_S(self, n=10):

    #     # log_S = np.log(self.S[:n])
    #     x_data = range(1, n + 1)

    #     plt.rcParams['figure.figsize'] = [10, 6]

    #     plt.scatter(x_data, self.S[:n])
    #     plt.yscale('log')
    #     # plt.xlabel('Significant value number')
    #     plt.ylabel('Magnitude')
    #     plt.xlabel('Singular value index')
    #     min, max = np.min(self.S[:n]), np.max(self.S[:n])
    #     # dif = max - min

    #     plt.ylim(min / 2, 2 * max)
    #     plt.title('First {} sing. values'.format(n))

    #     fig = plt.gcf()
    #     fig.canvas.set_window_title('SVD Analysis')

    #     plt.show()

    # def plot_figures_MCR(self):

    #     if self.C_MCR is None:
    #         return

    #     n = self.C_MCR.shape[1]
    #     plt.rcParams['figure.figsize'] = [12, 6]
    #     plt.subplots_adjust(left=0.05, right=0.95, top=0.95, wspace=0.33, hspace=0.33)

    #     plt.subplot(2, 2, 1)
    #     for i in range(n):
    #         plt.plot(self.wavelengths, self.A_MCR[i], label='Species {}'.format(i + 1))
    #     plt.xlabel('Wavelength / nm')
    #     plt.title('Spectra')
    #     plt.legend()

    #     plt.subplot(2, 2, 2)
    #     for i in range(n):
    #         plt.plot(self.times, self.C_MCR[:, i], label='Species {}'.format(i + 1))
    #     plt.xlabel('Time')
    #     plt.title('Concentrations')
    #     plt.legend()

    #     # plot residual matrix
    #     plt.subplot(2, 1, 2)
    #     A_dif = self.C_MCR @ self.A_MCR - self.matrix  # the difference matrix between MCR fit and original
    #     x, y = np.meshgrid(self.times, self.wavelengths)  # needed for pcolormesh to correctly scale the image
    #     plt.pcolormesh(x, y, A_dif.T, cmap='seismic', vmin=-np.abs(np.max(A_dif)), vmax=np.abs(np.max(A_dif)))
    #     plt.colorbar().set_label("$\\Delta$A")
    #     plt.title("Residual matrix A_fit - A")
    #     plt.ylabel('Wavelength / nm')
    #     plt.xlabel('Time')

    #     plt.tight_layout()

    #     fig = plt.gcf()
    #     # fig.canvas.set_window_title('Global fit - {}'.format(self.model.__class__.__name__))

    #     plt.show()

    # def plot_figures_one(self):

    #     n = self.model.n
    #     plt.rcParams['figure.figsize'] = [12, 6]
    #     plt.subplots_adjust(left=0.05, right=0.95, top=0.95, wspace=0.33, hspace=0.33)

    #     plt.subplot(2, 2, 1)
    #     for i in range(n):
    #         plt.plot(self.wavelengths, self.A[i], label='Species {}'.format(self.model.get_species_name(i)))
    #     plt.xlabel('Wavelength / nm')
    #     plt.title('Spectra')
    #     plt.legend()

    #     plt.subplot(2, 2, 2)
    #     for i in range(n):
    #         plt.plot(self.times, self.C[:, i], label='Species {}'.format(self.model.get_species_name(i)))
    #     plt.xlabel('Time')
    #     plt.title('Concentrations')
    #     plt.legend()

    #     # plot residual matrix
    #     plt.subplot(2, 1, 2)
    #     A_dif = self.Y_fit - self.matrix  # the difference matrix between fit and original
    #     x, y = np.meshgrid(self.times, self.wavelengths)  # needed for pcolormesh to correctly scale the image
    #     plt.pcolormesh(x, y, A_dif.T, cmap='seismic', vmin=-np.abs(np.max(A_dif)), vmax=np.abs(np.max(A_dif)))
    #     plt.colorbar().set_label("$\Delta$A")
    #     plt.title("Residual matrix A_fit - A")
    #     plt.ylabel('Wavelength / nm')
    #     plt.xlabel('Time')

    #     fig = plt.gcf()
    #     fig.canvas.set_window_title('Global fit - {}'.format(self.model.__class__.__name__))

    #     plt.show()

    # def plot_figures_multiple(self):

    #     # plt.figure(1)

    #     n = self.model.n
    #     plt.rcParams['figure.figsize'] = [12, 6]
    #     plt.subplots_adjust(left=0.05, right=0.95, bottom=0.05, top=0.95, wspace=0.33, hspace=0.33)

    #     for i in range(n):
    #         plt.subplot(2, n, i + 1)
    #         plt.plot(self.wavelengths, self.A[i])
    #         plt.title('Spectrum {}'.format(self.model.get_species_name(i)))

    #     for i in range(n):
    #         plt.subplot(2, n, i + n + 1)
    #         plt.plot(self.times, self.C[:, i])
    #         plt.title('Conc. {}'.format(self.model.get_species_name(i)))

    #     plt.show()
        
    

    # def plot_first_n_vectors(self, n=4, symlog=False, t_unit='ms'):
    #     # import matplotlib.ticker as ticker
    #     S_single = []  # define a list of diagonal matrices with only one singular value
    #     for i in range(n):
    #         S_i = np.zeros((self.S.shape[0], self.S.shape[0]))  # recreate diagonal matrices
    #         S_i[i, i] = self.S[i]
    #         S_single.append(S_i)

    #     plt.rcParams['figure.figsize'] = [15, 8]
    #     plt.subplots_adjust(left=0.05, right=0.95, bottom=0.05, top=0.95, wspace=0.26, hspace=0.41)

    #     x, y = np.meshgrid(self.wavelengths, self.times)  # needed for pcolormesh to correctly scale the image
    #     for i in range(n):
    #         plt.subplot(4, n, i + 1)
    #         plt.plot(self.wavelengths, self.V_T[i], color='black', lw=1.5)
    #         plt.title("{}. $V^T$ vector, $\Sigma_{{{}}}$ = {:.3g}".format(i + 1, str(i + 1) * 2, self.S[i]))
    #         plt.xlabel('Wavelength (nm)')
    #         # plt.xticks(np.arange(self.wavelengths[0], self.wavelengths[-1], step=50))
    #         # plt.xlim(self.wavelengths[0], self.wavelengths[-1])
    #         # plt.set_major_locator(ticker.MultipleLocator(100))
    #     for i in range(n):
    #         plt.subplot(4, n, i + n + 1)

    #         plt.plot(self.times, self.U[:, i], color='black', lw=1.5)
    #         plt.title("{}. $U$ vector".format(i + 1))
    #         plt.xlabel(f'Time ({t_unit})')

    #         if symlog:
    #             plt.xscale('symlog', subsx=[1, 2, 3, 4, 5, 6, 7, 8, 9], linscalex=1, linthreshx=100)
    #             xaxis = plt.gca().xaxis
    #             xaxis.set_minor_locator(MinorSymLogLocator(100))

    #     for i in range(n):
    #         plt.subplot(4, n, i + 2 * n + 1)

    #         A_rec = self.U @ S_single[i] @ self.V_T  # reconstruct the A matrix
    #         # setup z range so that white color corresponds to 0
    #         plt.pcolormesh(x, y, A_rec, cmap='seismic', vmin=-np.abs(np.max(A_rec)), vmax=np.abs(np.max(A_rec)))
    #         # plt.colorbar(label='Absorbance')
    #         plt.colorbar()
    #         plt.title("Component matrix {}".format(i + 1))
    #         plt.xlabel('Wavelength (nm)')
    #         plt.ylabel(f'Time ({t_unit})')

    #         if symlog:
    #             plt.xscale('symlog', subsx=[1, 2, 3, 4, 5, 6, 7, 8, 9], linscalex=1, linthreshx=100)
    #             xaxis = plt.gca().xaxis
    #             xaxis.set_minor_locator(MinorSymLogLocator(100))

    #         plt.gca().invert_yaxis()

    #         plt.subplot(4, n, i + 3 * n + 1)

    #         S = np.diag(self.S)

    #         Ur = self.U[:, :i + 1]
    #         Sr = S[:i + 1, :i + 1]
    #         V_Tr = self.V_T[:i + 1, :]
    #         Yr = Ur @ Sr @ V_Tr

    #         A_diff = Yr - self.matrix

    #         # E2 = (A_diff * A_diff).sum()
    #         R2 = (1 - (A_diff * A_diff).sum() / (self.matrix * self.matrix).sum())

    #         title = "Residuals (E=D$_{{rec}}$({}) - D)".format(i + 1)
    #         title += f", $R^2$={R2:.4g}"

    #         plt.pcolormesh(x, y, A_diff, cmap='seismic', vmin=-np.abs(np.max(A_diff)), vmax=np.abs(np.max(A_diff)))
    #         plt.colorbar()
    #         plt.title(title)
    #         plt.xlabel('Wavelength (nm)')
    #         plt.ylabel(f'Time ({t_unit})')

    #         if symlog:
    #             plt.xscale('symlog', subsx=[1, 2, 3, 4, 5, 6, 7, 8, 9], linscalex=1, linthreshx=100)
    #             xaxis = plt.gca().xaxis
    #             xaxis.set_minor_locator(MinorSymLogLocator(100))

    #         plt.gca().invert_yaxis()

    #     # plt.tight_layout()

    #     plt.show()


    @staticmethod
    def to_string(array, separator='\t', decimal_sep='.', new_line='\n'):
        list_array = array.tolist()

        list_array[0][0] = 'Wavelength'

        buffer = new_line.join(separator.join("{}".format(num) for num in row) for row in list_array)

        return buffer
