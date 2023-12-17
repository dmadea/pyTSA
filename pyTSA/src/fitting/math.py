import numpy as np
from numba import njit, vectorize

from scipy.linalg import svd
from math import erfc as math_erfc

# import scipy.constants as sc
# from scipy.linalg import lstsq



## inspiration from https://github.com/Tillsten/skultrafast/blob/9544c3cc3c3c3fa46b728156198807e2b21ba24b/skultrafast/base_funcs/pytorch_fitter.py
def blstsq(A: np.ndarray, B: np.ndarray, alpha=0.001):
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