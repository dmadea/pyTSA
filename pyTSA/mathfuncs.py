import numpy as np
from numba import njit, vectorize

# from scipy.linalg import svd
from math import erfc as math_erfc
from math import fabs
import scipy
posv = scipy.linalg.get_lapack_funcs(('posv'))
from scipy.linalg import lstsq as scipy_lstsq
from scipy.integrate import cumulative_trapezoid
from numpy.linalg import pinv


# import scipy.constants as sc
# from scipy.linalg import lstsq


## inspiration from https://github.com/Tillsten/skultrafast/blob/9544c3cc3c3c3fa46b728156198807e2b21ba24b/skultrafast/base_funcs/pytorch_fitter.py
def blstsq(A: np.ndarray, B: np.ndarray, alpha: float = 0.001) -> np.ndarray:
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


def lstsq(A: np.ndarray, B: np.ndarray, alpha: float = 0.0001) -> np.ndarray:
    """fast: solve least squares solution for X: AX=B by ordinary least squares, with direct solve,
    with optional Tikhonov regularization"""

    ATA = A.T.dot(A)
    ATB = A.T.dot(B)

    if alpha != 0:
        ATA.flat[::ATA.shape[-1] + 1] += alpha

    c, x, info = posv(ATA, ATB, lower=False,
                      overwrite_a=True,
                      overwrite_b=False)

    return x


def glstsq(A: np.ndarray, B: np.ndarray, alpha: float = 0.0001) -> tuple[np.ndarray, np.ndarray]:
    """Generalized Ridge regression. If A is a 3D tensor, it switches to batch least squares.
    
    Returns solution X and fit = A @ X"""

    if A.ndim == 3:
        X, fit = blstsq(A, B.T, alpha)
        return X, fit
    else:
        X = lstsq(A, B, alpha)
        return X, np.dot(A, X)



def _res_varpro(C, D):
    """Calculates residuals efficiently  by (I - CC+)D.
    Projector CC+ is calculated by SVD: CC+ = U @ U.T.

    Removal of the columns of U that does not correspond to data is needed
    (those columns whose corresponding singular values ar    e
    lower
    than
    tolerance)"""

    U, S, VT = np.linalg.svd(C, full_matrices=False)

    Sr = S[S > S[0] * 1e-10]
    Ur = U[:, :Sr.shape[0]]

    R = (np.eye(C.shape[0]) - Ur.dot(Ur.T)).dot(D)

    return R.flatten()


# def res_par_varpro(C, D, rcond=1e-10):
#     """Calculates residuals efficiently  by partitioned variable projection.
#     residuals are (I - CC+)D. C is tensor (n_w, n_t, k), D is matrix (n_t, n_w)
#     Projector CC+ is calculated by batched pseudoinverse
#     """
#
#     # t0 = time.perf_counter()
#
#     Cp = pinv(C, rcond=rcond)  # calculate batch pseudoinverse
#     I = np.eye(C.shape[1])[None, ...]  # eye matrix
#     P = I - np.matmul(C, Cp)  # calculate the projector
#     residuals = np.matmul(P, D.T[..., None]).squeeze().T  # and final residuals
#
#     # tdiff = time.perf_counter() - t0
#     # print(f"res_par_varpro took {tdiff * 1e3} ms")
#
#     return residuals


def res_parvarpro_pinv(C, D, rcond=1e-10):
    """Calculates residuals efficiently  by partitioned variable projection.
    residuals are (I - CC+)D. C is tensor (n_w, n_t, k), D is matrix (n_t, n_w)
    Projector CC+ is calculated by batched pseudoinverse
    """
    Cp = pinv(C, rcond=rcond)  # calculate batch pseudoinverse
    CpD = np.matmul(Cp, D.T[..., None])
    CCpD = np.matmul(C, CpD).squeeze().T
    residuals = D - CCpD
    return residuals


def res_parvarpro_svd(C, D, rcond=1e-10):
    """Calculates residuals efficiently  by partitioned variable projection.
    residuals are (I - CC+)D. C is tensor (n_w, n_t, k), D is matrix (n_t, n_w)
    Projector CC+ is calculated by batched svd
    """
    U, S, VT = np.linalg.svd(C, full_matrices=False)  # calculate batch svd of C tensor
    cutoff = rcond * np.max(S, axis=-1, keepdims=True)
    small = S < cutoff
    small = np.tile(small[:, None, :], [1, U.shape[1], 1])
    U[small] = 0  # set vector with small singular values to zero

    UT = np.transpose(U, (0, 2, 1))

    UTD = np.matmul(UT, D.T[..., None])
    UUTD = np.matmul(U, UTD).squeeze().T
    residuals = D - UUTD

    return residuals


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
def fold_exp(t: np.ndarray | float, k: np.ndarray | float, fwhm: np.ndarray | float) -> np.ndarray | float:

    w = fwhm / (2 * np.sqrt(np.log(2)))  # gaussian width
    tt = t

    if w > 0:
        return 0.5 * np.exp(k * (k * w * w / 4.0 - tt)) * math_erfc(w * k / 2.0 - tt / w)
    else:
        return np.exp(-tt * k) if tt >= 0 else 0
    

@vectorize(nopython=True, fastmath=False)
def gaussian(t: np.ndarray | float, sigma: np.ndarray | float) -> np.ndarray | float:
    if sigma > 0:
        return np.exp(-0.5 * t * t / (sigma * sigma))
    else:
        return 0

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

def chirp_correction(matrix: np.ndarray, times: np.ndarray, mu: np.ndarray | float,
                    t_smooth_order=1) -> tuple[np.ndarray, np.ndarray]:
    """
    Performs the chirp correction of the data array. Modifies the original data.
    mu is array defining time zero. The time dimension of data will be cropped to [-offset_before_zero:].
    t_smooth_order is the number of doubling of original time points. if 0, no doubling is performed.
    """

    if not isinstance(mu, np.ndarray):
        # mu is just a number, there is no wavelength dependency, change only times and return the original data
        new_times = times.copy() - mu
        return matrix, new_times
    
    offset = np.min(mu) - times[0]
    
    assert offset >= 0

    new_times = times.copy() - np.min(mu)

    # perform doubling of time points
    for i in range(t_smooth_order):
        new_times = double_points(new_times)

    new_D = np.empty((new_times.shape[0], matrix.shape[1]), dtype=np.float64)

    for i in range(matrix.shape[1]):
        # linear interpolation for each wavelength
        new_D[:, i] = np.interp(new_times, times - mu[i], matrix[:, i])

    return new_D, new_times



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
    
def fit_sum_exp(x: np.ndarray, y: np.ndarray, n: int = 2, fit_intercept=True) -> tuple[np.ndarray, np.ndarray]:
    """Fits the data with the sum of exponential function and returns multipliers of exponential and 
    lambda - the parameters in the exponent

    if fit_intercept is True, last multiplier will be the intercept, also the 0 will be added
    at the end of lambda vector"""

    assert isinstance(x, np.ndarray) and isinstance(y, np.ndarray)
    assert x.shape[0] == y.shape[0]
    assert x.shape[0] >= 2 * n

    Y_size = 2 * n + 1 if fit_intercept else 2 * n
    Y = np.empty((x.shape[0], Y_size))

    Y[:, 0] = cumulative_trapezoid(y, x, initial=0)
    for i in range(1, n):
        Y[:, i] = cumulative_trapezoid(Y[:, i - 1], x, initial=0)

    Y[:, -1] = 1
    for i in reversed(range(n, Y_size - 1)):
        Y[:, i] = Y[:, i + 1] * x

    A = scipy_lstsq(Y, y)[0]
    Ahat = np.diag(np.ones(n - 1), -1)
    Ahat[0] = A[:n]

    lambdas = np.linalg.eigvals(Ahat)
    # remove imaginary values
    if any(np.iscomplex(lambdas)):
        lambdas = lambdas.real

    X = np.exp(lambdas[None, :] * x[:, None])
    if fit_intercept:
        X = np.hstack((X, np.ones_like(x)[:, None]))
        lambdas = np.insert(lambdas, n, 0)
    multipliers = scipy_lstsq(X, y)[0]

    return multipliers, lambdas


def fit_polynomial_coefs(x: np.ndarray, y: np.ndarray, n: int = 3):
    X = np.ones((x.shape[0], n))  # polynomial regression matrix

    for i in range(1, n):
        X[:, i:] *= x[:, None] / 100

    coefs = scipy_lstsq(X, y)[0]
    return coefs