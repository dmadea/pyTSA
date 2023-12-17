import numpy as np
from numba import njit, vectorize

# from scipy.linalg import svd
from math import erfc as math_erfc
from math import fabs
import scipy
posv = scipy.linalg.get_lapack_funcs(('posv'))

# import scipy.constants as sc
# from scipy.linalg import lstsq


## inspiration from https://github.com/Tillsten/skultrafast/blob/9544c3cc3c3c3fa46b728156198807e2b21ba24b/skultrafast/base_funcs/pytorch_fitter.py
def blstsq(A: np.ndarray, B: np.ndarray, alpha: float = 0.001) -> tuple[np.ndarray, np.ndarray]:
    """
    Batched linear least-squares by numpy with direct solve method with optional Tikhonov regularization
    to prevent errors in case of singular matrices.
    Minimizes sum ||A_i x_i - B_i||_2^2 + alpha||Ix||_2^2 for x, where A is a tensor (L, M, N), B is matrix (L, M)

    Parameters
    ----------
        A : shape(L, M, N)
        B : shape(L, M)
        alpha: float

    Returns
    -------
        tuple of (coefficients.T, fit.T)
    """

    # https://en.wikipedia.org/wiki/Tikhonov_regularization
    # (A^T A + alpha*I) X = A^T B, solve for X

    AT = np.transpose(A, (0, 2, 1))  # transpose of A
    ATA = np.matmul(AT, A)  # A.T @ A
    ATB = np.matmul(AT, B[..., None])  # A.T @ B

    if alpha != 0:
        I = alpha * np.eye(ATA.shape[-1])  # alpha * identity matrix
        ATA += I[None, ...]  # add to ATA

    X = np.linalg.solve(ATA, ATB)  # solve batched linear system of equations

    fit = np.matmul(A, X).squeeze().T

    return X[..., 0].T, fit


def lstsq(A: np.ndarray, B: np.ndarray, alpha: float = 0.0001) -> tuple[np.ndarray, np.ndarray]:
    """fast: solve least squares solution for X: AX=B by ordinary least squares, with direct solve,
    with optional Tikhonov regularization"""

    ATA = A.T.dot(A)
    ATB = A.T.dot(B)

    if alpha != 0:
        ATA.flat[::ATA.shape[-1] + 1] += alpha

    c, x, info = posv(ATA, ATB, lower=False,
                      overwrite_a=True,
                      overwrite_b=False)

    return x, c

# copied from https://github.com/Tillsten/skultrafast/blob/23572ba9ea32238f34a8a15390fb572ecd8bc6fa/skultrafast/base_funcs/backend_tester.py
# © Till Stensitzki
# @vectorize(nopython=True, fastmath=False)
def fast_erfc(x):
    """
    Calculates the erfc near zero faster than
    the libary function, but has a bigger error, which
    is not a problem for us.
    Parameters
    ----------
    x: float
        The array
    Returns
    -------
    ret: float
        The erfc of x.
    """
    a1 = 0.278393
    a2 = 0.230389
    a3 = 0.000972
    a4 = 0.078108
    smaller = x < 0
    if smaller:
        x = x * -1.
    bot = 1 + a1 * x + a2 * x * x + a3 * x * x * x + a4 * x * x * x * x
    ret = 1. / (bot * bot * bot * bot)

    if smaller:
        ret = -ret + 2.

    return ret


@vectorize(nopython=True, fastmath=False)
def fold_exp(t, k, fwhm, t0):

    w = fwhm / (2 * np.sqrt(np.log(2)))  # width
    tt = t - t0

    if w > 0:
        return 0.5 * np.exp(k * (k * w * w / 4.0 - tt)) * math_erfc(w * k / 2.0 - tt / w)
    else:
        return np.exp(-tt * k) if tt >= 0 else 0

#
# def fold_exp_numpy(t, k, fwhm):
#     w = fwhm / (2 * np.sqrt(np.log(2)))  # width
#
#     return np.where(w > 0,
#             0.5 * np.exp(k * (k * w * w / 4.0 - t)) * erfc(w * k / 2.0 - t / w),
#             np.exp(-t * k) * np.heaviside(t, 1))


@vectorize(nopython=True, fastmath=False)
def photokin_factor(A):
    ln10 = np.log(10)
    ll2 = ln10 ** 2 / 2

    if A < 1e-3:
        return ln10 - A * ll2  # approximation with first two taylor series terms
    else:
        return (1 - np.exp(-A * ln10)) / A  # exact photokinetic factor


@njit(fastmath=True)
def _dc_dt_nb(c, t, I0, K, eps, V, t0):  # eps = spectra * l
    pA = c.reshape(-1, 1) * eps  # hadamard product - partial absorbances
    A = pA.sum(axis=0)  # total absorbance

    F = photokin_factor(A)  # (1-10^-A) / A

    product = K * (F * I0 * eps).sum(axis=-1)  # K @ diag(sum(F * I0 * eps * l))

    irr_on = 1 if t >= t0 else 0

    return irr_on * product.dot(c) / V  # final dot product / V


def get_target_C_profile(times, K, j):
    """K matrix, times to compute and j is initial population/concentration vector"""
    L, Q = np.linalg.eig(K)
    Q_inv = np.linalg.inv(Q)

    A2_T = Q * Q_inv.dot(j)  # Q @ np.diag(Q_inv.dot(j))

    t = times[:, None]
    C = np.exp(t * L[None, :]) * np.heaviside(t, 1)

    return C.dot(A2_T.T)


def _find_nearest_idx(array, value):
    idx = np.searchsorted(array, value, side="left")
    if idx > 0 and (idx == len(array) or fabs(value - array[idx - 1]) < fabs(value - array[idx])):
        return idx - 1
    else:
        return idx


def double_points(arr):
    """Inserts the averages of each pair of points in the array. The array must be sorted.
    The total shape of the array will be 2 * [arr.shape[0]] - 1

    So if input array is [-1, -0.5, 0, 5], the output will be
    [-1, -0.75, -0.5, -0.25, 0, 2.5, 5]
    """
    new_arr = np.empty(2 * arr.shape[0] - 1)

    avrg = (arr[:-1] + arr[1:]) / 2

    new_arr[::2] = arr
    new_arr[1::2] = avrg
    return new_arr

def chirp_correction(matrix: np.ndarray, times: np.ndarray, wavelengths: np.ndarray, mu: np.ndarray,
                    offset_before_zero=0.3, t_smooth_order=1) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Performs the chirp correction of the data array. Modifies the original data.
    mu is array defining time zero. The time dimension of data will be cropped to [-offset_before_zero:].
    t_smooth_order is the number of doubling of original time points. if 0, no doubling is performed.
    """

    assert np.min(mu) - times[0] >= offset_before_zero

    idx_0 = fi(times, -offset_before_zero)

    # create new time array starting with -offset_before_zero
    if times[idx_0] == -offset_before_zero:
        new_times = times[idx_0:]
    else:
        num = int(times[idx_0] < -offset_before_zero)
        new_times = np.insert(times[idx_0 + num:], 0, -offset_before_zero)

    # perform doubling of time points
    for i in range(t_smooth_order):
        new_times = double_points(new_times)

    new_D = np.empty((new_times.shape[0], wavelengths.shape[0]), dtype=np.float64)

    for i in range(wavelengths.shape[0]):
        # linear interpolation for each wavelength
        new_D[:, i] = np.interp(new_times, times - mu[i], matrix[:, i])

    return new_D, new_times, wavelengths



def fi(array: np.ndarray, values: int | float | list[float | int]) -> int | list[int]:
    if not is_iterable(values):
        return _find_nearest_idx(array, values)

    result = []

    for val in values:
        result.append(_find_nearest_idx(array, val))

    return np.asarray(result)


def find_nearest(array, value):
    idx = fi(array, value)
    return array[idx]


def crop_data(matrix: np.ndarray, axis0_data: np.ndarray, axis1_data: np.ndarray,
              ax0_0=None, ax0_1=None, ax1_0=None, ax1_1=None):
    ax0_start = fi(axis0_data, ax0_0) if ax0_0 is not None else 0
    ax0_end = fi(axis0_data, ax0_1) + 1 if ax0_1 is not None else matrix.shape[0]

    ax1_start = fi(axis1_data, ax1_0) if ax1_0 is not None else 0
    ax1_end = fi(axis1_data, ax1_1) + 1 if ax1_1 is not None else matrix.shape[1]

    mat_crop = matrix[ax0_start:ax0_end, ax1_start:ax1_end]
    axis0_data_crop = axis0_data[ax0_start:ax0_end]
    axis1_data_crop = axis1_data[ax1_start:ax1_end]

    return mat_crop, axis0_data_crop, axis1_data_crop


def is_iterable(obj):
    try:
        iter(obj)
    except Exception:
        return False
    else:
        return True