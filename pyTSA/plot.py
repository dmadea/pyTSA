
import numpy as np
import matplotlib.pyplot as plt

from .mathfuncs import chirp_correction, fi, is_iterable

from matplotlib.colors import LinearSegmentedColormap
from matplotlib import cm
from matplotlib import colormaps as cmaps
import matplotlib as mpl
import matplotlib.colors as c
from numpy import ma

from matplotlib.ticker import AutoLocator, SymmetricalLogLocator, ScalarFormatter, AutoMinorLocator, MultipleLocator, Locator, FixedLocator

WL_LABEL = 'Wavelength / nm'
WN_LABEL = "Wavenumber / $10^{4}$ cm$^{-1}$"
CONC_LABEL = 'Concentration / $\mu$mol L$^{-1}$'

plt.rcParams.update({'font.size': 12})

# default values
# plt.rcParams.update({'xtick.major.size': 3.5, 'ytick.major.size': 3.5})
# plt.rcParams.update({'xtick.minor.size': 2, 'ytick.minor.size': 2})
# plt.rcParams.update({'xtick.major.width': 0.8, 'ytick.major.width': 0.8})
# plt.rcParams.update({'xtick.minor.width': 0.6, 'ytick.minor.width': 0.6})

plt.rcParams.update({'xtick.major.size': 5, 'ytick.major.size': 5})
plt.rcParams.update({'xtick.minor.size': 2.5, 'ytick.minor.size': 2.5})
plt.rcParams.update({'xtick.major.width': 1, 'ytick.major.width': 1})
plt.rcParams.update({'xtick.minor.width': 0.8, 'ytick.minor.width': 0.8})
mpl.rcParams['hatch.linewidth'] = 0.8  # hatch linewidth

LEGEND_FONT_SIZE = 10
MAJOR_TICK_DIRECTION = 'in'  # in, out or inout
MINOR_TICK_DIRECTION = 'in'  # in, out or inout

X_SIZE, Y_SIZE = 5, 4.5
# dA_unit = '$\Delta A$ / $10^{-3}$'
dA_unit = '$\Delta A$'


COLORS = ['blue', 'red', 'green', 'orange', 'black', 'yellow']
COLORS_gradient = ['blue', 'lightblue']


def save_data2csv(fname, data, x, name='DAS', unit='', delimiter = ','):
    names = [f'{name} {i + 1}' for i in range(data.shape[0])]

    mat = np.vstack((x, data))
    buffer = f'Wavelength'
    buffer += delimiter + delimiter.join(names) + '\n'
    buffer += '\n'.join(delimiter.join(f"{num}" for num in row) for row in mat.T)

    with open(fname, 'w', encoding='utf8') as f:
        f.write(buffer)


class MajorSymLogLocator(SymmetricalLogLocator):
    """
    Determine the tick locations for symmetric log axes.
    Slight modification .... TODO
    """

    def tick_values(self, vmin, vmax):
        base = self._base
        linthresh = self._linthresh

        if vmax < vmin:
            vmin, vmax = vmax, vmin

        # if -linthresh < vmin < vmax < linthresh:
        #     # only the linear range is present
        #     return [vmin, vmax]

        # Lower log range is present
        has_a = (vmin < -linthresh)
        # Upper log range is present
        has_c = (vmax > linthresh)

        # Check if linear range is present
        has_b = (has_a and vmax > -linthresh) or (has_c and vmin < linthresh) or -linthresh < vmin < vmax < linthresh

        def get_log_range(lo, hi):
            lo = np.floor(np.log(lo) / np.log(base))
            hi = np.ceil(np.log(hi) / np.log(base))
            return lo, hi

        # Calculate all the ranges, so we can determine striding
        a_lo, a_hi = (0, 0)
        if has_a:
            a_upper_lim = min(-linthresh, vmax)
            a_lo, a_hi = get_log_range(abs(a_upper_lim), abs(vmin) + 1)

        c_lo, c_hi = (0, 0)
        if has_c:
            c_lower_lim = max(linthresh, vmin)
            c_lo, c_hi = get_log_range(c_lower_lim, vmax + 1)

        # Calculate the total number of integer exponents in a and c ranges
        total_ticks = (a_hi - a_lo) + (c_hi - c_lo)
        if has_b:
            total_ticks += 1
        stride = max(total_ticks // (self.numticks - 1), 1)

        ticklocs = []  # places to put major ticks

        if has_a:
            ticklocs.extend(-1 * (base ** (np.arange(a_lo, a_hi,
                                                    stride)[::-1])))

        if has_c:
            ticklocs.extend(base ** (np.arange(c_lo, c_hi, stride)))

        if has_b:
            linthresh_base = base ** np.floor(np.log(linthresh) / np.log(base))

            major_ticks = np.arange(-linthresh, linthresh + linthresh_base, linthresh_base)

            for tick in major_ticks:
                if tick not in ticklocs:
                    ticklocs.append(tick)

        ret = np.array(ticklocs)
        ret.sort()

        return self.raise_if_exceeds(ret)


class MinorSymLogLocator(Locator):
    """
    Dynamically find minor tick positions based on the positions of
    major ticks for a symlog scaling.... Modified, TODO
    """

    def __init__(self, linthresh=1, n_lin_ints=10, n_log_ints=10, base=10.):
        """
        Ticks will be placed between the major ticks.
        The placement is linear for x between -linthresh and linthresh,
        otherwise its logarithmically. nints gives the number of
        intervals that will be bounded by the minor ticks.
        """
        self.linthresh = linthresh
        self.nintervals = n_lin_ints
        self.n_log_intervals = n_log_ints
        self.base = base

    def __call__(self):
        vmin, vmax = self.axis.get_view_interval()
        return self.tick_values(vmin, vmax)

    def tick_values(self, vmin, vmax):
        # Return the locations of the ticks
        majorlocs = self.axis.get_majorticklocs()

        if len(majorlocs) == 1:
            return self.raise_if_exceeds(np.array([]))

        # add temporary major tick locs at either end of the current range
        # to fill in minor tick gaps
        dmlower = majorlocs[1] - majorlocs[0]  # major tick difference at lower end
        dmupper = majorlocs[-1] - majorlocs[-2]  # major tick difference at upper end

        # add temporary major tick location at the lower end
        if majorlocs[0] != 0. and ((majorlocs[0] != self.linthresh and dmlower > self.linthresh) or (
                dmlower == self.linthresh and majorlocs[0] < 0)):
            majorlocs = np.insert(majorlocs, 0, majorlocs[0] * self.base)
        else:
            majorlocs = np.insert(majorlocs, 0, majorlocs[0] - self.linthresh)

        # add temporary major tick location at the upper end
        if majorlocs[-1] != 0. and ((np.abs(majorlocs[-1]) != self.linthresh and dmupper > self.linthresh) or (
                dmupper == self.linthresh and majorlocs[-1] > 0)):
            majorlocs = np.append(majorlocs, majorlocs[-1] * self.base)
        else:
            majorlocs = np.append(majorlocs, majorlocs[-1] + self.linthresh)

        # iterate through minor locs
        minorlocs = []

        # handle the lowest part
        for i in range(1, len(majorlocs)):
            majorstep = majorlocs[i] - majorlocs[i - 1]
            if abs(majorlocs[i - 1] + majorstep / 2) < self.linthresh:
                ndivs = self.nintervals
            else:
                # ndivs = self.n_log_intervals - 1

                # if the difference between major locks is not full decade
                # log_ratio = np.sign(majorlocs[i - 1]) * np.log(majorlocs[i] / majorlocs[i - 1]) / np.log(self.base)
                # if log_ratio != 1:
                base_difference = majorstep / (self.base ** np.floor(np.log(majorstep) / np.log(self.base)))
                ndivs = (self.n_log_intervals - 1) * base_difference / (self.base - 1)

            minorstep = majorstep / ndivs
            locs = np.arange(majorlocs[i - 1], majorlocs[i], minorstep)[1:]
            minorlocs.extend(locs)

        return self.raise_if_exceeds(np.array(minorlocs))


def eps_label(factor):
    num = np.log10(1 / factor).astype(int)
    return f'$\\varepsilon$ / $(10^{{{num}}}$ L mol$^{{-1}}$ cm$^{{-1}})$'


def setup_wavenumber_axis(ax, x_label=WN_LABEL,
                          x_major_locator=None, x_minor_locator=AutoMinorLocator(5), factor=1e3):
    secondary_ax = ax.secondary_xaxis('top', functions=(lambda x: factor / x, lambda x: 1 / (factor * x)))

    secondary_ax.tick_params(which='major', direction=MAJOR_TICK_DIRECTION)
    secondary_ax.tick_params(which='minor', direction=MINOR_TICK_DIRECTION)

    if x_major_locator:
        secondary_ax.xaxis.set_major_locator(x_major_locator)

    if x_minor_locator:
        secondary_ax.xaxis.set_minor_locator(x_minor_locator)

    secondary_ax.set_xlabel(x_label)

    return secondary_ax


def set_main_axis(ax, x_label=WL_LABEL, y_label="Absorbance", xlim=(None, None), ylim=(None, None),
                  x_major_locator=None, x_minor_locator=None, y_major_locator=None, y_minor_locator=None):
    ax.set_ylabel(y_label)
    ax.set_xlabel(x_label)
    if xlim[0] is not None:
        ax.set_xlim(xlim)
    if ylim[0] is not None:
        ax.set_ylim(ylim)

    if x_major_locator:
        ax.xaxis.set_major_locator(x_major_locator)

    if x_minor_locator:
        ax.xaxis.set_minor_locator(x_minor_locator)

    if y_major_locator:
        ax.yaxis.set_major_locator(y_major_locator)

    if y_minor_locator:
        ax.yaxis.set_minor_locator(y_minor_locator)

    ax.tick_params(axis='both', which='major', direction=MAJOR_TICK_DIRECTION)
    ax.tick_params(axis='both', which='minor', direction=MINOR_TICK_DIRECTION)


def get_sym_space(vmin, vmax, n):
    """Return evenly spaced tics that are however symetric around zero (without zero!) so that tics are: (-t_i, t_i+1)"""
    raw_step = (vmax - vmin) / (n - 1)

    pos_steps = int(np.ceil((vmax - 0.5 * raw_step) / raw_step))
    neg_steps = int(np.ceil((abs(vmin) - 0.5 * raw_step) / raw_step))

    return np.linspace((neg_steps + 0.5) * -raw_step, (pos_steps + 0.5) * raw_step, pos_steps + neg_steps + 2)


def _plot_tilts(ax, norm, at_value, axis='y', inverted_axis=False):
    d = 0.015
    tilt = 0.4

    sep = 1 - norm(at_value) if inverted_axis else norm(at_value)
    kwargs = dict(transform=ax.transAxes, color='k', clip_on=False)

    x_vals = [[-d * 0.8, +d * 0.8],
             [1 - d * 0.8, 1 + d * 0.8],
             [0, 1]]
    y_vals = [[sep - d * tilt, sep + d * tilt],
             [sep - d * tilt, sep + d * tilt],
             [sep, sep]]

    if axis == 'x':
        x_vals, y_vals = y_vals, x_vals

    ax.plot(x_vals[0], y_vals[0], **kwargs)
    ax.plot(x_vals[1], y_vals[1], **kwargs)
    ax.plot(x_vals[2], y_vals[2], ls='dotted', lw=1, **kwargs)


def plot_traces_onefig_ax(ax, D, D_fit, times, wavelengths, mu: float | np.ndarray | None = None, wls=(355, 400, 450, 500, 550), marker_size=10,
                          marker_linewidth=1, n_lin_bins=10, n_log_bins=10, t_axis_formatter=ScalarFormatter(), log_y=False,
                          marker_facecolor='white', alpha=0.8, y_lim=(None, None), plot_tilts=True, wl_unit='nm', t_unit='ps',
                          linthresh=1, linscale=1, colors=None, D_mul_factor=1, legend_spacing=0.2, lw=1.5,
                          legend_loc='best', z_unit=dA_unit, x_label='Time', symlog=True,
                          t_lim=(None, None), plot_zero_line=True, **kwargs):
    
    """wls can contain a range of wavelengths, in this case, the integrated intensity will be calculated in this range and plotted"""

    n = wls.__len__()
    t = times
    mu = np.zeros_like(wavelengths) if mu is None else mu
    if not isinstance(mu, np.ndarray):
        mu = np.ones_like(wavelengths) * mu

    t_lim = ((times - mu.min())[0] if t_lim[0] is None else t_lim[0], times[-1] if t_lim[1] is None else t_lim[1])

    set_main_axis(ax, xlim=t_lim, ylim=y_lim, y_label=z_unit, x_label=f"{x_label} / {t_unit}",
                  y_minor_locator=None, x_minor_locator=None)

    if plot_zero_line:
        ax.plot(t - mu[0].mean(), np.zeros_like(t), ls='--', color='black', lw=1)

    colors = plt.rcParams['axes.prop_cycle'].by_key()['color'] if colors is None else colors

    for i in range(n):
        color_points = c.to_rgb(colors[i])
        color_line = np.asarray(color_points) * 0.7
        
        if is_iterable(wls[i]):
            k, l = fi(wavelengths, wls[i])
            trace = np.trapz(D[:, k:l+1], wavelengths[k:l+1], axis=1)
            trace_fit = np.trapz(D_fit[:, k:l+1], wavelengths[k:l+1], axis=1)
            tt = t - (mu[k] + mu[l+1]) / 2
            label=f'({wls[i][0]}$-${wls[i][1]}) {wl_unit}'
            
            ## save the traces to csv
            # fpath = "/Users/dominikmadea/Library/CloudStorage/OneDrive-OIST/Projects/Heptazines + femto/Python/fits/Ryoko"
            # fpath = r"C:\Users\domin\OneDrive - OIST\Projects\Heptazines + femto\Python\fits\Ryoko"
            # save_data2csv(f"{fpath}/traces_{i}.csv", np.vstack((trace, trace_fit)), tt, 'traces', delimiter=',') 
        else:
            idx = fi(wavelengths, wls[i])
            trace = D[:, idx]
            trace_fit = D_fit[:, idx]
            tt = t - mu[idx]
            label=f'{wls[i]} {wl_unit}'

        ax.scatter(tt, trace * D_mul_factor, edgecolor=color_points, facecolor=marker_facecolor,
                   alpha=alpha, marker='o', s=marker_size, linewidths=marker_linewidth)

        ax.scatter([], [], edgecolor=color_points, facecolor=marker_facecolor,
                   alpha=alpha, marker='o', label=label, s=marker_size * 2, linewidths=marker_linewidth)
        ax.plot(tt, trace_fit * D_mul_factor, lw=lw, color=color_line)

    ax.xaxis.set_ticks_position('both')
    ax.yaxis.set_ticks_position('both')

    if symlog:
        ax.set_xscale('symlog', subs=[2, 3, 4, 5, 6, 7, 8, 9], linscale=linscale, linthresh=linthresh)

        ax.xaxis.set_major_locator(MajorSymLogLocator(base=10, linthresh=linthresh))
        ax.xaxis.set_minor_locator(MinorSymLogLocator(linthresh, n_lin_ints=n_lin_bins, n_log_ints=n_log_bins, base=10))

        if plot_tilts:
            norm = c.SymLogNorm(vmin=t_lim[0], vmax=t_lim[1], linscale=linscale, linthresh=linthresh, base=10,
                                clip=True)
            _plot_tilts(ax, norm, linthresh, 'x')

    if log_y:
        ax.set_yscale('log')

    if t_axis_formatter:
        ax.xaxis.set_major_formatter(t_axis_formatter)

    l = ax.legend(loc=legend_loc, frameon=False, labelspacing=legend_spacing)
    for text, color in zip(l.get_texts(), colors):
        text.set_color(color)

    ax.set_axisbelow(False)


# def plot_traces_onefig_ax(ax, D, D_fit, times, wavelengths, mu=None, wls=(355, 400, 450, 500, 550), marker_size=10,
#                           marker_linewidth=1, n_lin_bins=10, n_log_bins=10, t_axis_formatter=ScalarFormatter(),
#                           marker_facecolor='white', alpha=0.8, y_lim=(None, None),
#                           linthresh=1, linscale=1, colors=None, D_mul_factor=1e3, legend_spacing=0.2, lw=1.5,
#                           legend_loc='lower right', y_label=dA_unit, x_label='Time / ps', symlog=True, t_lim=(None, None)):
#
#     n = wls.__len__()
#     t = times
#     mu = np.zeros_like(t) if mu is None else mu
#     norm = mpl.colors.SymLogNorm(vmin=t[0], vmax=t[-1], linscale=linscale, linthresh=linthresh, base=10, clip=True)
#
#     t_lim = (times[0] if t_lim[0] is None else t_lim[0], times[-1] if t_lim[1] is None else t_lim[1])
#     set_main_axis(ax, xlim=t_lim, ylim=y_lim, y_label=y_label, x_label=x_label,
#                   y_minor_locator=None, x_minor_locator=None)
#
#     ax.plot(t - mu[0].mean(), np.zeros_like(t), ls='--', color='black', lw=1)
#
#     colors = plt.rcParams['axes.prop_cycle'].by_key()['color'] if colors is None else colors
#
#     for i in range(n):
#         color_points = c.to_rgb(colors[i])
#         color_line = np.asarray(color_points) * 0.7
#
#         idx = fi(wavelengths, wls[i])
#         tt = t - mu[idx]
#         ax.scatter(tt, D[:, idx] * D_mul_factor, edgecolor=color_points, facecolor=marker_facecolor,
#                    alpha=alpha, marker='o', s=marker_size, linewidths=marker_linewidth)
#
#         ax.scatter([], [], edgecolor=color_points, facecolor=marker_facecolor,
#                    alpha=alpha, marker='o', label=f'{wls[i]} nm', s=marker_size * 2, linewidths=marker_linewidth)
#         ax.plot(tt, D_fit[:, idx] * D_mul_factor, lw=lw, color=color_line)
#
#     ax.xaxis.set_ticks_position('both')
#     ax.yaxis.set_ticks_position('both')
#
#     if symlog:
#         ax.set_xscale('symlog', subs=[2, 3, 4, 5, 6, 7, 8, 9], linscale=linscale, linthresh=linthresh)
#
#         ax.xaxis.set_major_locator(MajorSymLogLocator(base=10, linthresh=linthresh))
#         ax.xaxis.set_minor_locator(MinorSymLogLocator(linthresh, n_lin_ints=n_lin_bins, n_log_ints=n_log_bins, base=10))
#
#         d = 0.015
#         tilt = 0.4
#         ax.set_ylim(ax.get_ylim())
#
#         sep = norm(linthresh)
#         kwargs = dict(transform=ax.transAxes, color='k', clip_on=False)
#         ax.plot([sep - d * tilt, sep + d * tilt], [-d * 0.8, +d * 0.8], **kwargs)
#         ax.plot([sep - d * tilt, sep + d * tilt], [1 - d * 0.8, 1 + d * 0.8], **kwargs)
#         ax.vlines(linthresh, ax.get_ylim()[0], ax.get_ylim()[1], ls='dotted', lw=1, color='k', zorder=10)
#
#     if t_axis_formatter:
#         ax.xaxis.set_major_formatter(t_axis_formatter)
#
#     l = ax.legend(loc=legend_loc, frameon=False, labelspacing=legend_spacing)
#     for text, color in zip(l.get_texts(), colors):
#         text.set_color(color)
#
#     ax.set_axisbelow(False)


def plot_spectra_ax(ax, D, times, wavelengths, selected_times=(0, 100), zero_reg=None, z_unit=dA_unit, D_mul_factor=1,
                    legend_spacing=0.05, colors=None, lw=1.5, darkens_factor_cmap=1, cmap='jet', columnspacing=2,
                    legend_loc='lower right', legend_ncol=2, ylim=None, label_prefix='t = ', time_unit='ps'):

    _D = D * D_mul_factor

    if zero_reg[0] is not None:
        cut_idxs = fi(wavelengths, zero_reg)
        _D[:, cut_idxs[0]:cut_idxs[1]] = np.nan

    set_main_axis(ax, y_label=z_unit, xlim=(wavelengths[0], wavelengths[-1]),
                  x_minor_locator=AutoMinorLocator(10), x_major_locator=MultipleLocator(100), y_minor_locator=None)
    _ = setup_wavenumber_axis(ax, x_major_locator=MultipleLocator(0.5))

    t_idxs = fi(times, selected_times)

    _cmap = cm.get_cmap(cmap, t_idxs.shape[0])
    ax.axhline(0, wavelengths[0], wavelengths[-1], ls='--', color='black', lw=1)

    for i in range(t_idxs.shape[0]):
        if colors is None:
            color = np.asarray(c.to_rgb(_cmap(i))) * darkens_factor_cmap
            color[color > 1] = 1
        else:
            color = colors[i]

        ax.plot(wavelengths, _D[t_idxs[i]], color=color, lw=lw, label=f'{label_prefix}${selected_times[i]:.3g}$ {time_unit}')

    l = ax.legend(loc=legend_loc, frameon=False, labelspacing=legend_spacing, ncol=legend_ncol,
                  # handlelength=0, handletextpad=0,
                  columnspacing=columnspacing)
    for i, text in enumerate(l.get_texts()):
        # text.set_ha('right')
        text.set_color(_cmap(i))

    ax.set_axisbelow(False)
    ax.yaxis.set_ticks_position('both')

def setup_twin_x_axis(ax, y_label="$I_{0,\\mathrm{m}}$ / $10^{-10}$ einstein s$^{-1}$ nm$^{-1}$",
                      x_label=None, ylim=(None, None), y_major_locator=None, y_minor_locator=None,
                      keep_zero_aligned=True):
    ax2 = ax.twinx()

    ax2.tick_params(which='major', direction='in')
    ax2.tick_params(which='minor', direction='in')

    if y_major_locator:
        ax2.yaxis.set_major_locator(y_major_locator)

    if y_minor_locator:
        ax2.yaxis.set_minor_locator(y_minor_locator)

    ax2.set_ylabel(y_label)

    if keep_zero_aligned and ylim[0] is None and ylim[1] is not None:
        # a = bx/(x-1)
        ax1_ylim = ax.get_ylim()
        x = -ax1_ylim[0] / (ax1_ylim[1] - ax1_ylim[0])  # position of zero in ax1, from 0, to 1
        a = ylim[1] * x / (x - 1)  # calculates the ylim[0] so that zero position is the same for both axes
        ax2.set_ylim(a, ylim[1])

    elif ylim[0] is not None:
        ax2.set_ylim(ylim)

    return ax2

def plot_kinetics_ax(ax, D, times, wavelengths,   lw=0.5,  time_unit='ps',
                     n_spectra=50, linscale=1, linthresh=100, cmap='jet_r', major_ticks_labels=(100, 1000), emph_t=(0, 200, 1000),
                     inset_loc=(0.75, 0.1, 0.03, 0.8), alpha=0.5,
                     y_label='Absorbance', x_label=WL_LABEL, x_lim=(230, 600),
                     LED_source: list = None, add_wavenumber_axis=True, D_mul_factor=1):
    t = times

    set_main_axis(ax, x_label=x_label, y_label=y_label, xlim=x_lim, x_minor_locator=None, y_minor_locator=None)
    if add_wavenumber_axis:
        setup_wavenumber_axis(ax)

    cmap = cm.get_cmap(cmap)
    norm = mpl.colors.SymLogNorm(vmin=t[0], vmax=t[-1], linscale=linscale, linthresh=linthresh, base=10, clip=True)

    tsb_idxs = fi(t, emph_t)
    ts_real = np.round(t[tsb_idxs])

    x_space = np.linspace(0, 1, n_spectra, endpoint=True, dtype=np.float64)

    t_idx_space = fi(t, norm.inverse(x_space))
    t_idx_space = np.sort(np.asarray(list(set(t_idx_space).union(set(tsb_idxs)))))

    for i in t_idx_space:
        x_real = norm(t[i])
        x_real = 0 if np.ma.is_masked(x_real) else x_real
        ax.plot(wavelengths, D_mul_factor * D[i], color=cmap(x_real),
                lw=1.5 if i in tsb_idxs else lw,
                alpha=1 if i in tsb_idxs else alpha,
                zorder=1 if i in tsb_idxs else 0)

    cbaxes = ax.inset_axes(inset_loc)

    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])
    cbar = plt.colorbar(sm, cax=cbaxes, orientation='vertical',
                        format=mpl.ticker.ScalarFormatter(),
                        label=f'Time / {time_unit}')

    cbaxes.invert_yaxis()

    minor_ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90, 200, 300, 400, 500, 600, 700, 800, 900] + list(
        np.arange(2e3, t[-1], 1e3))
    cbaxes.yaxis.set_ticks(cbar._locate(minor_ticks), minor=True)

    major_ticks = np.sort(np.hstack((np.asarray([100, 1000]), ts_real)))
    major_ticks_labels = np.sort(np.hstack((np.asarray(major_ticks_labels), ts_real)))

    cbaxes.yaxis.set_ticks(cbar._locate(major_ticks), minor=False)
    cbaxes.set_yticklabels([(f'{num:0.0f}' if num in major_ticks_labels else "") for num in major_ticks])

    for ytick, ytick_label, _t in zip(cbaxes.yaxis.get_major_ticks(), cbaxes.get_yticklabels(), major_ticks):
        if _t in ts_real:
            color = cmap(norm(_t))
            ytick_label.set_color(color)
            ytick_label.set_fontweight('bold')
            ytick.tick2line.set_color(color)
            ytick.tick2line.set_markersize(5)
            # ytick.tick2line.set_markeredgewidth(2)

    if LED_source is not None:
        ax_sec = setup_twin_x_axis(ax, ylim=(None, LED_source[1].max() * 3), y_label="",
                                   y_major_locator=FixedLocator([]))
        ax_sec.fill(LED_source[0], LED_source[1], facecolor='gray', alpha=0.5)
        ax_sec.plot(LED_source[0], LED_source[1], color='black', ls='dotted', lw=1)


    #
    #
    #
    # _D = D * D_mul_factor
    #
    # if zero_reg[0] is not None:
    #     cut_idxs = fi(wavelengths, zero_reg)
    #     _D[:, cut_idxs[0]:cut_idxs[1]] = np.nan
    #
    # set_main_axis(ax, y_label=z_unit, xlim=(wavelengths[0], wavelengths[-1]),
    #               x_minor_locator=AutoMinorLocator(10), x_major_locator=MultipleLocator(100), y_minor_locator=None)
    # _ = setup_wavenumber_axis(ax, x_major_locator=MultipleLocator(0.5))
    #
    # t_idxs = fi(times, selected_times)
    #
    # _cmap = cm.get_cmap(cmap, t_idxs.shape[0])
    # ax.axhline(0, wavelengths[0], wavelengths[-1], ls='--', color='black', lw=1)
    #
    # for i in range(t_idxs.shape[0]):
    #     if colors is None:
    #         color = np.asarray(c.to_rgb(_cmap(i))) * darkens_factor_cmap
    #         color[color > 1] = 1
    #     else:
    #         color = colors[i]
    #
    #     ax.plot(wavelengths, _D[t_idxs[i]], color=color, lw=lw, label=f'{label_prefix}${selected_times[i]:.3g}$ {time_unit}')
    #
    # l = ax.legend(loc=legend_loc, frameon=False, labelspacing=legend_spacing, ncol=legend_ncol,
    #               # handlelength=0, handletextpad=0,
    #               columnspacing=columnspacing)
    # for i, text in enumerate(l.get_texts()):
    #     # text.set_ha('right')
    #     text.set_color(_cmap(i))
    #
    # ax.set_axisbelow(False)
    # ax.yaxis.set_ticks_position('both')


def plot_data_ax(fig, ax, matrix, times, wavelengths, symlog=True, log=False, t_unit='ps',
                 z_unit=dA_unit, cmap='diverging', z_lim=(None, None),
                 t_lim=(None, None), w_lim=(None, None), linthresh=1, linscale=1, D_mul_factor=1,
                 n_lin_bins=10, n_log_bins=10, plot_tilts=True, squeeze_z_range_factor=1,
                 y_major_formatter=ScalarFormatter(), y_label='Time delay',
                 x_minor_locator=AutoMinorLocator(10), x_major_locator=None, n_levels=30, plot_countours=True,
                 colorbar_locator=AutoLocator(), colorbarpad=0.04, title='', log_z=False,
                 diverging_white_cmap_tr=0.98, hatch='/////', colorbar_aspect=35, add_wn_axis=False,
                 x_label="Wavelength / nm", plot_chirp_corrected=False, mu=None, draw_chirp=True, **kwargs):
    """data is individual dataset"""

    # assert type(data) == Data

    D = matrix * D_mul_factor
    
    if plot_chirp_corrected:
        assert mu is not None, "chirp is None"
        D, times = chirp_correction(D, times, mu)

    t_lim = (times[0] if t_lim[0] is None else t_lim[0], times[-1] if t_lim[1] is None else t_lim[1])
    w_lim = (wavelengths[0] if w_lim[0] is None else w_lim[0], wavelengths[-1] if w_lim[1] is None else w_lim[1])

    if mu is not None and draw_chirp and not plot_chirp_corrected:
        _mu = mu if isinstance(mu, np.ndarray) else np.ones_like(wavelengths) * mu
        ax.plot(wavelengths, _mu, color='black', lw=1.5, ls='--')

    zmin = np.min(D) if z_lim[0] is None else z_lim[0]
    zmax = np.max(D) if z_lim[1] is None else z_lim[1]

    # assuming zmax > 0 and zmin < 0
    zmin = squeeze_z_range_factor * zmin
    zmax = squeeze_z_range_factor * zmax

    # if z_lim[0] is not None:
    D[D < zmin] = zmin

    # if z_lim[1] is not None:
    D[D > zmax] = zmax

    register_div_cmap(zmin, zmax)
    register_div_white_cmap(zmin, zmax, diverging_white_cmap_tr)

    x, y = np.meshgrid(wavelengths, times)  # needed for pcolormesh to correctly scale the image

    # plot data matrix D

    set_main_axis(ax, xlim=w_lim, ylim=t_lim, x_label=x_label, y_label=f'{y_label} / {t_unit}',
                  x_minor_locator=x_minor_locator, x_major_locator=x_major_locator, y_minor_locator=None)
    if add_wn_axis:
        w_ax = setup_wavenumber_axis(ax, x_major_locator=MultipleLocator(0.5))
        w_ax.tick_params(which='minor', direction='out')
        w_ax.tick_params(which='major', direction='out')

    #     ax.set_facecolor((0.8, 0.8, 0.8, 1))
    if ma.is_masked(D):  # https://stackoverflow.com/questions/41664850/hatch-area-using-pcolormesh-in-basemap
        m_idxs = np.argwhere(D.mask[0] > 0).squeeze()
        wl_range = [wavelengths[m_idxs[0] - 1], wavelengths[m_idxs[-1] + 1]]
        ax.fill_between(wl_range, [t_lim[0], t_lim[0]], [t_lim[1], t_lim[1]], facecolor="none",
                        hatch=hatch, edgecolor="k", linewidth=0.0)

    #     mappable = ax.pcolormesh(x, y, D, cmap=cmap, vmin=zmin, vmax=zmax)
    levels = get_sym_space(zmin, zmax, n_levels)

    # mappable = ax.contourf(x, y, D, cmap=cmap, vmin=zmin, vmax=zmax, levels=levels, antialiased=True)
    if log_z:
        norm = mpl.colors.LogNorm(vmin=np.max(np.asarray([1e-9, zmin])), vmax=zmax, clip=True)
        mappable = ax.pcolormesh(x, y, D, cmap=cmap, norm=norm)
    else:
        norm = mpl.colors.Normalize(vmin=zmin,vmax=zmax, clip=True)
        mappable = ax.contourf(x, y, D, cmap=cmap, norm=norm, levels=levels, antialiased=True)

    if plot_countours:
        cmap_colors = cm.get_cmap(cmap)
        colors = cmap_colors(np.linspace(0, 1, n_levels + 1))
        colors *= 0.45  # plot contours as darkens colors of colormap, blue -> darkblue, white -> gray ...
        ax.contour(x, y, D, colors=colors, levels=levels, antialiased=True, linewidths=0.1,
                   alpha=1, linestyles='-')

    ax.invert_yaxis()

    ax.tick_params(which='major', direction='out')
    ax.tick_params(which='minor', direction='out')
    ax.yaxis.set_ticks_position('both')

    ax.set_axisbelow(False)
    ax.set_title(title)

    fig.colorbar(mappable, ax=ax, label=z_unit, orientation='vertical', aspect=colorbar_aspect, pad=colorbarpad,
                 ticks=None if log_z else colorbar_locator)  # , format=ScalarFormatter()  ticks=colorbar_locator
    
    if symlog:
        ax.set_yscale('symlog', subs=[2, 3, 4, 5, 6, 7, 8, 9], linscale=linscale, linthresh=linthresh)
        ax.yaxis.set_major_locator(MajorSymLogLocator(base=10, linthresh=linthresh))
        ax.yaxis.set_minor_locator(MinorSymLogLocator(linthresh, n_lin_ints=n_lin_bins, n_log_ints=n_log_bins, base=10))

        if plot_tilts:
            norm = c.SymLogNorm(vmin=t_lim[0], vmax=t_lim[1], linscale=linscale, linthresh=linthresh, base=10,
                                clip=True)
            _plot_tilts(ax, norm, linthresh, 'y', inverted_axis=True)
    elif log:
        ax.set_yscale('log')

    if y_major_formatter:
        ax.yaxis.set_major_formatter(y_major_formatter)

def plot_fitresiduals_axes(ax_data, ax_res, times: np.ndarray, trace_data: np.ndarray, trace_fit: np.ndarray, trace_residuals: np.ndarray, 
                           x_label="Time", t_unit='ns', y_lim_residuals=(None, None), z_unit='A', t_lim=(None, None),
                           y_lim=(None, None), lw_data=1, lw_fit=1, symlog=False, linthresh=1, linscale=1, log_y=False, title="", **kwargs):


    set_main_axis(ax_data, x_label="", y_label=z_unit, xlim=t_lim, ylim=y_lim)
    set_main_axis(ax_res, x_label=f"{x_label} / {t_unit}", ylim=y_lim_residuals,
                    y_label='res.', xlim=t_lim)

    # plot zero lines
    ax_res.axline((0, 0), slope=0, ls='--', color='black', lw=0.5)

    ax_data.tick_params(labelbottom=False)

    ax_data.set_title(title)
    ax_data.plot(times, trace_data, lw=lw_data, color='black')
    ax_data.plot(times, trace_fit, lw=lw_fit, color='red')
    ax_res.plot(times, trace_residuals, lw=lw_data, color='black')

    ax_data.set_axisbelow(False)
    ax_res.set_axisbelow(False)

    ax_data.yaxis.set_ticks_position('both')
    ax_data.xaxis.set_ticks_position('both')

    ax_res.yaxis.set_ticks_position('both')
    ax_res.xaxis.set_ticks_position('both')

    if symlog:
        ax_data.set_xscale('symlog', subs=[2, 3, 4, 5, 6, 7, 8, 9], linscale=linscale, linthresh=linthresh)
        ax_res.set_xscale('symlog', subs=[2, 3, 4, 5, 6, 7, 8, 9], linscale=linscale, linthresh=linthresh)
        ax_data.xaxis.set_minor_locator(MinorSymLogLocator(linthresh))
        ax_res.xaxis.set_minor_locator(MinorSymLogLocator(linthresh))

    if log_y:
        ax_data.set_yscale('log')

#
# def plot_data_ax(fig, ax, matrix, times, wavelengths, symlog=True, t_unit='ps',
#                  z_unit=dA_unit, cmap='diverging', z_lim=(None, None),
#                  t_lim=(None, None), w_lim=(None, None), linthresh=1, linscale=1, D_mul_factor=1e3,
#                  n_lin_bins=10, n_log_bins=10,
#                  y_major_formatter=ScalarFormatter(),
#                  x_minor_locator=AutoMinorLocator(10), n_levels=30, plot_countours=True,
#                  colorbar_locator=MultipleLocator(50),
#                  diverging_white_cmap_tr=0.98, hatch='/////', colorbar_aspect=35, add_wn_axis=True, x_label="Wavelength / nm"):
#     """data is individual dataset"""
#
#     # assert type(data) == Data
#
#     t_lim = (times[0] if t_lim[0] is None else t_lim[0], times[-1] if t_lim[1] is None else t_lim[1])
#     w_lim = (
#         wavelengths[0] if w_lim[0] is None else w_lim[0], wavelengths[-1] if w_lim[1] is None else w_lim[1])
#
#     D = matrix.copy() * D_mul_factor
#
#     zmin = np.min(D) if z_lim[0] is None else z_lim[0]
#     zmax = np.max(D) if z_lim[1] is None else z_lim[1]
#
#     if z_lim[0] is not None:
#         D[D < zmin] = zmin
#
#     if z_lim[1] is not None:
#         D[D > zmax] = zmax
#
#     register_div_cmap(zmin, zmax)
#     register_div_white_cmap(zmin, zmax, diverging_white_cmap_tr)
#
#     x, y = np.meshgrid(wavelengths, times)  # needed for pcolormesh to correctly scale the image
#
#     # plot data matrix D
#
#     set_main_axis(ax, xlim=w_lim, ylim=t_lim, x_label=x_label, y_label=f'Time delay / {t_unit}',
#                   x_minor_locator=x_minor_locator, y_minor_locator=None)
#     if add_wn_axis:
#         w_ax = setup_wavenumber_axis(ax, x_major_locator=MultipleLocator(0.5))
#         w_ax.tick_params(which='minor', direction='out')
#         w_ax.tick_params(which='major', direction='out')
#
#     #     ax.set_facecolor((0.8, 0.8, 0.8, 1))
#     if ma.is_masked(D):  # https://stackoverflow.com/questions/41664850/hatch-area-using-pcolormesh-in-basemap
#         m_idxs = np.argwhere(D.mask[0] > 0).squeeze()
#         wl_range = [wavelengths[m_idxs[0] - 1], wavelengths[m_idxs[-1] + 1]]
#         ax.fill_between(wl_range, [t_lim[0], t_lim[0]], [t_lim[1], t_lim[1]], facecolor="none",
#                         hatch=hatch, edgecolor="k", linewidth=0.0)
#
#     #     mappable = ax.pcolormesh(x, y, D, cmap=cmap, vmin=zmin, vmax=zmax)
#     levels = get_sym_space(zmin, zmax, n_levels)
#     mappable = ax.contourf(x, y, D, cmap=cmap, vmin=zmin, vmax=zmax, levels=levels, antialiased=True)
#
#     if plot_countours:
#         cmap_colors = cm.get_cmap(cmap)
#         colors = cmap_colors(np.linspace(0, 1, n_levels + 1))
#         colors *= 0.45  # plot contours as darkens colors of colormap, blue -> darkblue, white -> gray ...
#         ax.contour(x, y, D, colors=colors, levels=levels, antialiased=True, linewidths=0.2,
#                    alpha=1, linestyles='-')
#
#     ax.invert_yaxis()
#
#     ax.tick_params(which='major', direction='out')
#     ax.tick_params(which='minor', direction='out')
#
#     ax.set_axisbelow(False)
#
#     fig.colorbar(mappable, ax=ax, label=z_unit, orientation='vertical', aspect=colorbar_aspect, pad=0.025,
#                  ticks=colorbar_locator)
#
#     if symlog:
#         ax.set_yscale('symlog', subs=[2, 3, 4, 5, 6, 7, 8, 9], linscale=linscale, linthresh=linthresh)
#         ax.yaxis.set_major_locator(MajorSymLogLocator(base=10, linthresh=linthresh))
#         ax.yaxis.set_minor_locator(MinorSymLogLocator(linthresh, n_lin_ints=n_lin_bins, n_log_ints=n_log_bins, base=10))
#
#     if y_major_formatter:
#         ax.yaxis.set_major_formatter(y_major_formatter)


def plot_SADS_ax(ax, wls, SADS, Artifacts: np.ndarray | None = None, labels=None, zero_reg=(None, None), z_unit=dA_unit, D_mul_factor=1,
                 legend_spacing=0.2, legend_ncol=1, colors=None, lw=1.5, show_legend=True,
                 area_plot_data=(None, None), area_plot_color='violet', area_plot_data2=(None, None),
                 area_plot_color2='blue', title="",
                 area_plot_alpha=0.2, area_plot_alpha2=0.1, w_lim=(None, None), **kwargs):
    _SADS = SADS.copy() * D_mul_factor
    if zero_reg[0] is not None:
        cut_idxs = fi(wls, zero_reg)
        _SADS[cut_idxs[0]:cut_idxs[1]] = np.nan

    w_lim = (wls[0] if w_lim[0] is None else w_lim[0], wls[-1] if w_lim[1] is None else w_lim[1])
    w1, w2 = fi(wls, w_lim)
    _SADS = _SADS[w1:w2 + 1]
    wls = wls[w1:w2 + 1]

    # fctr = 1.1
    # _min, _max = abs(np.nanmin(_SADS)) * fctr * np.sign(np.nanmin(_SADS)), abs(np.nanmax(_SADS)) * fctr * np.sign(np.nanmax(_SADS))

    set_main_axis(ax, y_label=z_unit, xlim=w_lim, #, ylim=(_min, _max),
                  x_minor_locator=AutoMinorLocator(), x_major_locator=None, y_minor_locator=None)
    # _ = setup_wavenumber_axis(ax, x_major_locator=MultipleLocator(0.5))

    cmap = cm.get_cmap('gist_rainbow', _SADS.shape[1] / 0.75)

    ax.axhline(0, ls='--', color='black', lw=1)
    labels = list('ABCDEFGHIJ') if labels is None else labels

    for i in range(_SADS.shape[1]):
        if colors is None:
            color = np.asarray(c.to_rgb(cmap(i))) * 0.9
            color[color > 1] = 1
        else:
            color = colors[i]

        ax.plot(wls, _SADS[:, i], color=color, lw=lw, label=labels[i] if i < len(labels) else "LPL")

    if Artifacts is not None:
        colorsArt = ['black', 'grey', 'navy', 'pink']
        for i in range(Artifacts.shape[1]):
            ax.plot(wls, Artifacts[:, i], color=colorsArt[i], lw=1, ls='--', label=f"Artifact {i + 1}")

    if area_plot_data[0] is not None:
        ax.fill_between(area_plot_data[0], area_plot_data[1], color=area_plot_color, alpha=area_plot_alpha, zorder=0)
    if area_plot_data2[0] is not None:
        ax.fill_between(area_plot_data2[0], area_plot_data2[1], color=area_plot_color2, alpha=area_plot_alpha2,
                        zorder=-10)
    
    ax.set_title(title)

    if show_legend:
        ax.legend(frameon=False, labelspacing=legend_spacing, ncol=legend_ncol)
    ax.set_axisbelow(False)
    ax.yaxis.set_ticks_position('both')


def register_div_white_cmap(zmin, zmax, treshold=0.98):
    """Registers `diverging` diverging color map just suited for data.

    With extra white space at around zero - for filled countours colormaps to ensure zero is white."""

    diff = zmax - zmin
    w = np.abs(zmin / diff)  # white color point set to zero z value

    tr = treshold

    _cdict = {'red': ((0.0, 0.0, 0.0),
                      (w / 2, 0.0, 0.0),
                      (w * tr, 1.0, 1.0),
                      (w + (1 - w) * (1 - tr), 1.0, 1.0),
                      (w + (1 - w) / 3, 1.0, 1.0),
                      (w + (1 - w) * 2 / 3, 1.0, 1.0),
                      (1.0, 0.3, 0.3)),

              'green': ((0.0, 0, 0),
                        (w / 2, 0.0, 0.0),
                        (w * tr, 1.0, 1.0),
                        (w + (1 - w) * (1 - tr), 1.0, 1.0),
                        (w + (1 - w) / 3, 1.0, 1.0),
                        (w + (1 - w) * 2 / 3, 0.0, 0.0),
                        (1.0, 0.0, 0.0)),

              'blue': ((0.0, 0.3, 0.3),
                       (w / 2, 1.0, 1.0),
                       (w * tr, 1.0, 1.0),
                       (w + (1 - w) * (1 - tr), 1.0, 1.0),
                       (w + (1 - w) / 3, 0.0, 0.0),
                       (w + (1 - w) * 2 / 3, 0.0, 0.0),
                       (1.0, 0.0, 0.0))
              }

    custom_cmap = LinearSegmentedColormap('diverging_white_tr', _cdict)
    # colormaps.register(custom_cmap, 'diverging_white_tr', force=True)
    cmaps.unregister('diverging_white_tr')
    cmaps.register(custom_cmap, name='diverging_white_tr')


def register_div_cmap(zmin, zmax):  # colors for femto TA heat maps: dark blue, blue, white, yellow, red, dark red
    """c map suited for the data so that zero will be always in white color."""

    diff = zmax - zmin
    w = np.abs(zmin / diff)  # white color point set to zero z value

    _cdict = {'red': ((0.0, 0.0, 0.0),
                      (w / 2, 0.0, 0.0),
                      (w, 1.0, 1.0),
                      (w + (1 - w) / 3, 1.0, 1.0),
                      (w + (1 - w) * 2 / 3, 1.0, 1.0),
                      (1.0, 0.3, 0.3)),

              'green': ((0.0, 0, 0),
                        (w / 2, 0.0, 0.0),
                        (w, 1.0, 1.0),
                        (w + (1 - w) / 3, 1.0, 1.0),
                        (w + (1 - w) * 2 / 3, 0.0, 0.0),
                        (1.0, 0.0, 0.0)),

              'blue': ((0.0, 0.3, 0.3),
                       (w / 2, 1.0, 1.0),
                       (w, 1.0, 1.0),
                       (w + (1 - w) / 3, 0.0, 0.0),
                       (w + (1 - w) * 2 / 3, 0.0, 0.0),
                       (1.0, 0.0, 0.0))
              }

    custom_cmap = LinearSegmentedColormap('diverging', _cdict)
    cmaps.unregister('diverging')
    cmaps.register(custom_cmap, name='diverging')
    # colormaps.register(custom_cmap, 'diverging', force=True)



