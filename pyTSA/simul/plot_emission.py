#!/usr/bin/env python3
"""Compare kMC emission / distance outputs from one or more run folders.

Usage:
  python3 plot_emission.py OUTDIR RUN_NAME [RUN_NAME ...]

OUTDIR     parent directory: figures are written here; run folders live under it
RUN_NAME   subdirectory name(s) inside OUTDIR (each with summary.csv, …)

Comparison plots (all runs overlaid): emission decay, r_max, CT emission r,
hop-distance histogram. The 3D morphology plot is only made when a single
RUN_NAME is given.
"""
from __future__ import annotations

import csv
import os
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

COLORS = [
    "#0072b2",
    "#d55e00",
    "#009e73",
    "#cc79a7",
    "#e69f00",
    "#56b4e9",
    "#000000",
    "#f0e442",
]


def _read_summary(path: str) -> dict:
    rows = list(csv.DictReader(open(path)))
    if not rows:
        raise ValueError(f"empty summary: {path}")
    return rows[0]


def _run_label(rundir: str, summary: dict, name: str | None = None) -> str:
    return name if name else (os.path.basename(os.path.abspath(rundir).rstrip(os.sep)) or rundir)


def load_run(rundir: str, name: str | None = None) -> dict:
    summary = _read_summary(os.path.join(rundir, "summary.csv"))
    decay = list(csv.DictReader(open(os.path.join(rundir, "decay_curves.csv"))))
    run = {
        "dir": rundir,
        "name": name or os.path.basename(rundir.rstrip(os.sep)),
        "label": _run_label(rundir, summary, name=name),
        "summary": summary,
        "t": np.array([float(r["t_s"]) for r in decay]),
        "I_LE": np.array([float(r["I_LE"]) for r in decay]),
        "I_CT": np.array([float(r["I_CT"]) for r in decay]),
        "I_total": np.array([float(r["I_total"]) for r in decay]),
        "r_max": None,
        "r_ct": None,
        "hop": None,
    }
    rmax_path = os.path.join(rundir, "rmax.csv")
    if os.path.isfile(rmax_path):
        rows = list(csv.DictReader(open(rmax_path)))
        r = np.array([float(r["r_max_nm"]) for r in rows], dtype=float)
        run["r_max"] = r[r > 0]
    ctr_path = os.path.join(rundir, "ct_emission_r.csv")
    if os.path.isfile(ctr_path):
        rows = list(csv.DictReader(open(ctr_path)))
        run["r_ct"] = np.array([float(r["r_nm"]) for r in rows], dtype=float)
    hop_path = os.path.join(rundir, "hop_r.csv")
    if os.path.isfile(hop_path):
        rows = list(csv.DictReader(open(hop_path)))
        if rows and "count" in rows[0]:
            run["hop"] = {
                "r_lo": np.array([float(r["r_lo_nm"]) for r in rows], dtype=float),
                "r_hi": np.array([float(r["r_hi_nm"]) for r in rows], dtype=float),
                "count": np.array([float(r["count"]) for r in rows], dtype=float),
            }
    return run


def plot_decay(runs: list[dict], outdir: str) -> None:
    fig, ax = plt.subplots(1, 1, figsize=(6.4, 4.8))
    for i, run in enumerate(runs):
        c = COLORS[i % len(COLORS)]
        t, I_LE, I_CT, I_tot = run["t"], run["I_LE"], run["I_CT"], run["I_total"]
        phi_LE = float(run["summary"]["phi_LE"])
        phi_CT = float(run["summary"]["phi_CT"])
        lab = run["label"]
        if np.any(I_LE > 0):
            ax.loglog(t[I_LE > 0], I_LE[I_LE > 0], "-", color=c, lw=1.8,
                      label=rf"{lab}  LE ($\phi={phi_LE:.3f}$)")
        if np.any(I_CT > 0):
            ax.loglog(t[I_CT > 0], I_CT[I_CT > 0], "--", color=c, lw=1.8,
                      label=rf"{lab}  CT ($\phi={phi_CT:.3f}$)")
        m = I_tot > 0
        if np.any(m):
            ax.loglog(t[m], I_tot[m], ":", color=c, lw=1.1, alpha=0.75)
    ax.set_xlabel("time (s)")
    ax.set_ylabel(r"emission rate  $I(t)$  (s$^{-1}$ / trajectory)")
    ax.set_title("Emission decay (log–log)")
    ax.set_xlim(1e-12, 1e-2)
    ax.legend(loc="lower left", framealpha=0.92, fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "emission_decay.png"), dpi=300)
    plt.close(fig)


def plot_rmax(runs: list[dict], outdir: str) -> None:
    datasets = [(r, r["r_max"]) for r in runs if r["r_max"] is not None and r["r_max"].size]
    if not datasets:
        return
    all_r = np.concatenate([d for _, d in datasets])
    n_bins = min(60, max(12, int(np.sqrt(all_r.size / max(len(datasets), 1)))))
    bins = np.histogram_bin_edges(all_r, bins=n_bins)
    fig, ax = plt.subplots(figsize=(5.8, 4.3))
    for i, (run, r) in enumerate(datasets):
        c = COLORS[i % len(COLORS)]
        ax.hist(r, bins=bins, density=True, histtype="stepfilled",
                color=c, alpha=0.28, edgecolor=c, linewidth=1.4,
                label=rf"{run['label']}  ($N={r.size}$, $\langle r\rangle={np.mean(r):.2f}$)")
    ax.set_xlabel(r"maximum distance from centre  $r_{\mathrm{max}}$  (nm)")
    ax.set_ylabel("probability density")
    ax.set_title(r"Max separation (excl. LE emission)")
    ax.legend(loc="best", framealpha=0.92, fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "rmax_hist.png"), dpi=300)
    plt.close(fig)


def plot_ct_r(runs: list[dict], outdir: str) -> None:
    datasets = [(r, r["r_ct"]) for r in runs if r["r_ct"] is not None and r["r_ct"].size]
    if not datasets:
        return
    all_r = np.concatenate([d for _, d in datasets])
    n_bins = min(60, max(12, int(np.sqrt(all_r.size / max(len(datasets), 1)))))
    bins = np.histogram_bin_edges(all_r, bins=n_bins)
    fig, ax = plt.subplots(figsize=(5.8, 4.3))
    for i, (run, r) in enumerate(datasets):
        c = COLORS[i % len(COLORS)]
        ax.hist(r, bins=bins, density=True, histtype="stepfilled",
                color=c, alpha=0.28, edgecolor=c, linewidth=1.4,
                label=rf"{run['label']}  ($N={r.size}$, $\langle r\rangle={np.mean(r):.2f}$)")
    ax.set_xlabel(r"CT emission distance  $r$  (nm)")
    ax.set_ylabel("probability density")
    ax.set_title("CT emission $r$ histogram")
    ax.legend(loc="best", framealpha=0.92, fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "ct_emission_r_hist.png"), dpi=300)
    plt.close(fig)


def plot_hop_r(runs: list[dict], outdir: str) -> None:
    datasets = [(r, r["hop"]) for r in runs if r["hop"] is not None]
    if not datasets:
        return
    fig, ax = plt.subplots(figsize=(5.8, 4.3))
    for i, (run, hop) in enumerate(datasets):
        c = COLORS[i % len(COLORS)]
        r_lo, r_hi, counts = hop["r_lo"], hop["r_hi"], hop["count"]
        widths = r_hi - r_lo
        n_hop = float(counts.sum())
        if n_hop <= 0:
            continue
        # probability density so different total hop counts are comparable
        dens = counts / (n_hop * np.maximum(widths, 1e-30))
        r_cent = 0.5 * (r_lo + r_hi)
        mean_r = float(np.sum(r_cent * counts) / n_hop)
        ax.plot(r_cent, dens, "-", color=c, lw=1.8,
                label=rf"{run['label']}  ($N={{{int(n_hop)}}}$, $\langle r\rangle\approx{mean_r:.2f}$)")
        ax.fill_between(r_cent, dens, color=c, alpha=0.12, step=None)
    ax.set_xlabel(r"host–host hop distance  $r_{\mathrm{hop}}$  (nm)")
    ax.set_ylabel("probability density")
    ax.set_title("Hopping distance histogram")
    ax.legend(loc="best", framealpha=0.92, fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "hop_r_hist.png"), dpi=300)
    plt.close(fig)


def plot_trajectories_3d(rundir: str, outdir: str, summary: dict) -> None:
    hosts_path = os.path.join(rundir, "morphology_hosts.csv")
    centers_path = os.path.join(rundir, "morphology_centers.csv")
    meta_path = os.path.join(rundir, "morphology_meta.csv")
    paths_path = os.path.join(rundir, "sample_traj_paths.csv")
    traj_meta_path = os.path.join(rundir, "sample_traj_meta.csv")
    if not (os.path.isfile(hosts_path) and os.path.isfile(centers_path)):
        return

    from matplotlib import cm
    from matplotlib.colors import Normalize

    hosts = list(csv.DictReader(open(hosts_path)))
    centers = list(csv.DictReader(open(centers_path)))
    hx = np.array([float(r["x_nm"]) for r in hosts])
    hy = np.array([float(r["y_nm"]) for r in hosts])
    hz = np.array([float(r["z_nm"]) for r in hosts])
    hE = np.array([float(r["LUMO_eV"]) for r in hosts])
    cx = np.array([float(r["x_nm"]) for r in centers])
    cy = np.array([float(r["y_nm"]) for r in centers])
    cz = np.array([float(r["z_nm"]) for r in centers])

    Lbox = float(summary["L_nm"])
    if os.path.isfile(meta_path):
        Lbox = float(list(csv.DictReader(open(meta_path)))[0]["L_nm"])

    fig = plt.figure(figsize=(8.2, 7.0))
    ax = fig.add_subplot(111, projection="3d")
    for s, e in [
        ((0, 0, 0), (Lbox, 0, 0)), ((0, 0, 0), (0, Lbox, 0)), ((0, 0, 0), (0, 0, Lbox)),
        ((Lbox, Lbox, 0), (0, Lbox, 0)), ((Lbox, Lbox, 0), (Lbox, 0, 0)),
        ((Lbox, Lbox, 0), (Lbox, Lbox, Lbox)),
        ((0, Lbox, Lbox), (Lbox, Lbox, Lbox)), ((0, Lbox, Lbox), (0, 0, Lbox)),
        ((0, Lbox, Lbox), (0, Lbox, 0)),
        ((Lbox, 0, Lbox), (0, 0, Lbox)), ((Lbox, 0, Lbox), (Lbox, Lbox, Lbox)),
        ((Lbox, 0, Lbox), (Lbox, 0, 0)),
    ]:
        ax.plot([s[0], e[0]], [s[1], e[1]], [s[2], e[2]],
                color="#888", lw=0.7, alpha=0.55)

    cmap = cm.viridis
    norm = Normalize(vmin=np.min(hE), vmax=np.max(hE))
    sc = ax.scatter(hx, hy, hz, c=hE, cmap=cmap, norm=norm,
                    s=3, alpha=0.45, linewidths=0, depthshade=False,
                    label="hosts (LUMO)")
    ax.scatter(cx, cy, cz, c="k", s=15, depthshade=False,
               edgecolors="white", linewidths=0.4, label="centers", zorder=5)

    traj_colors = {
        "LE_emission": "#d55e00",
        "CT_emission": "#0072b2",
        "timeout": "#009e73",
        "steplimit": "#cc79a7",
    }
    if os.path.isfile(paths_path) and os.path.isfile(traj_meta_path):
        path_rows = list(csv.DictReader(open(paths_path)))
        tmeta = list(csv.DictReader(open(traj_meta_path)))
        if tmeta:
            active_c = int(float(tmeta[0]["c_idx"]))
            ax.scatter([cx[active_c - 1]], [cy[active_c - 1]], [cz[active_c - 1]],
                       c="k", s=100, marker="*", edgecolors="#f0f0f0",
                       linewidths=0.6, label=f"active centre {active_c}", zorder=6)

        by_tid: dict[int, list] = {}
        for r in path_rows:
            by_tid.setdefault(int(r["traj_id"]), []).append(r)

        outcome_seen: set[str] = set()
        for tm in tmeta:
            tid = int(tm["traj_id"])
            outcome = tm["outcome"]
            pts = by_tid.get(tid, [])
            if not pts:
                continue
            xs = np.array([float(p["x_nm"]) for p in pts])
            ys = np.array([float(p["y_nm"]) for p in pts])
            zs = np.array([float(p["z_nm"]) for p in pts])
            col = traj_colors.get(outcome, "#333333")
            label = None
            if outcome not in outcome_seen:
                label = outcome.replace("_", " ")
                outcome_seen.add(outcome)
            seg_x, seg_y, seg_z = [xs[0]], [ys[0]], [zs[0]]
            for i in range(1, len(xs)):
                jump = (abs(xs[i] - xs[i - 1]) > 0.5 * Lbox or
                        abs(ys[i] - ys[i - 1]) > 0.5 * Lbox or
                        abs(zs[i] - zs[i - 1]) > 0.5 * Lbox)
                if jump:
                    if len(seg_x) > 1:
                        ax.plot(seg_x, seg_y, seg_z, color=col, lw=1.6, alpha=0.95,
                                label=label)
                        label = None
                    seg_x, seg_y, seg_z = [xs[i]], [ys[i]], [zs[i]]
                else:
                    seg_x.append(xs[i])
                    seg_y.append(ys[i])
                    seg_z.append(zs[i])
            if len(seg_x) > 1:
                ax.plot(seg_x, seg_y, seg_z, color=col, lw=1.6, alpha=0.95, label=label)
            elif len(seg_x) == 1:
                ax.scatter(seg_x, seg_y, seg_z, c=col, s=35, depthshade=False, label=label)
            ax.scatter([xs[-1]], [ys[-1]], [zs[-1]], c=col, s=40,
                       edgecolors="k", linewidths=0.4, depthshade=False, zorder=7)

    cb = fig.colorbar(sc, ax=ax, shrink=0.65, pad=0.08)
    cb.set_label("host LUMO (eV)")
    ax.set_xlim(0, Lbox)
    ax.set_ylim(0, Lbox)
    ax.set_zlim(0, Lbox)
    ax.set_xlabel("x (nm)")
    ax.set_ylabel("y (nm)")
    ax.set_zlabel("z (nm)")
    ax.set_title("Disordered box + sample trajectories")
    ax.legend(loc="upper left", fontsize=8, framealpha=0.9)
    try:
        ax.set_box_aspect((1, 1, 1))
    except Exception:
        pass
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "trajectories_3d.png"), dpi=300)
    plt.close(fig)


def main(argv: list[str] | None = None) -> None:
    argv = list(sys.argv[1:] if argv is None else argv)
    if len(argv) < 2:
        print(
            "Usage: python3 plot_emission.py OUTDIR RUN_NAME [RUN_NAME ...]",
            file=sys.stderr,
        )
        sys.exit(1)

    plot_outdir = argv[0]
    run_names = argv[1:]
    run_dirs: list[str] = []
    for name in run_names:
        # Names are folders inside OUTDIR (allow accidental absolute paths too).
        d = name if os.path.isabs(name) else os.path.join(plot_outdir, name)
        if not os.path.isdir(d):
            print(f"error: not a directory: {d}", file=sys.stderr)
            sys.exit(1)
        if not os.path.isfile(os.path.join(d, "summary.csv")):
            print(f"error: missing summary.csv in {d}", file=sys.stderr)
            sys.exit(1)
        run_dirs.append(d)

    os.makedirs(plot_outdir, exist_ok=True)
    plt.rcParams.update({
        "font.size": 11,
        "axes.labelsize": 12,
        "legend.fontsize": 9,
        "figure.dpi": 140,
        "savefig.bbox": "tight",
        "axes.grid": True,
        "grid.alpha": 0.35,
    })

    runs = [load_run(d, name=n) for d, n in zip(run_dirs, run_names)]
    plot_decay(runs, plot_outdir)
    plot_rmax(runs, plot_outdir)
    plot_ct_r(runs, plot_outdir)
    plot_hop_r(runs, plot_outdir)

    if len(runs) == 1:
        plot_trajectories_3d(runs[0]["dir"], plot_outdir, runs[0]["summary"])

    print("wrote figures to", plot_outdir)
    print("  compared runs:", ", ".join(run_names))


if __name__ == "__main__":
    main()
