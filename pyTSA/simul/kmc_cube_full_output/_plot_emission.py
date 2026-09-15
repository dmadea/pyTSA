import csv
import os
import sys
import matplotlib
matplotlib.use("Agg")
import numpy as np
import matplotlib.pyplot as plt

outdir = sys.argv[1]
decay = list(csv.DictReader(open(os.path.join(outdir, "decay_curves.csv"))))
summary = list(csv.DictReader(open(os.path.join(outdir, "summary.csv"))))[0]

t = np.array([float(r["t_s"]) for r in decay])
I_LE = np.array([float(r["I_LE"]) for r in decay])
I_CT = np.array([float(r["I_CT"]) for r in decay])
I_tot = np.array([float(r["I_total"]) for r in decay])

k_LE = 1.0 / float(summary["tau_LE_s"])
phi_LE = float(summary["phi_LE"])
phi_CT = float(summary["phi_CT"])
n_traj = int(float(summary["N_traj"]))

plt.rcParams.update({
    "font.size": 11,
    "axes.labelsize": 12,
    "legend.fontsize": 9,
    "figure.dpi": 140,
    "savefig.bbox": "tight",
    "axes.grid": True,
    "grid.alpha": 0.35,
})

fig, ax = plt.subplots(1, 1, figsize=(6, 4.7))

m = I_tot > 0
if np.any(I_LE > 0):
    ax.loglog(t[I_LE > 0], I_LE[I_LE > 0], "-", color="#d55e00", lw=2.0,
              label=rf"LE emission  ($\phi={phi_LE:.3f}$)")
if np.any(I_CT > 0):
    ax.loglog(t[I_CT > 0], I_CT[I_CT > 0], "-", color="#0072b2", lw=2.0,
              label=rf"CT emission  ($\phi={phi_CT:.3f}$)")
if np.any(m):
    ax.loglog(t[m], I_tot[m], "--", color="#333", lw=1.2, alpha=0.8, label="total")
ax.set_xlabel("time (s)")
ax.set_ylabel(r"emission rate  $I(t)$  (s$^{-1}$ / trajectory)")
ax.set_title("Emission decay (log–log)")
ax.set_xlim(1e-12, 1e-2)
ax.legend(loc="lower left", framealpha=0.92)

fig.suptitle(
    rf"LE / CT emission  |  $N={{{n_traj}}}$  |  "
    rf"$N_{{\mathrm{{host}}}}={{{int(float(summary['N_host']))}}}$, "
    rf"$L={{{float(summary['L_nm']):.1f}}}$ nm, "
    rf"$\tau_{{\mathrm{{LE}}}}={{{float(summary['tau_LE_s'])*1e9:.0f}}}$ ns, "
    rf"$\tau^{{0}}_{{\mathrm{{CT}}}}={{{float(summary['tau0_CT_s'])*1e9:.0f}}}$ ns",
    y=1.02,
)
fig.tight_layout()
fig.savefig(os.path.join(outdir, "emission_decay.png"), dpi=300)
plt.close(fig)

# max separation from centre (LE emission excluded: r_max = 0 by construction)
rmax_path = os.path.join(outdir, "rmax.csv")
if os.path.isfile(rmax_path):
    rmax_rows = list(csv.DictReader(open(rmax_path)))
    r_max = np.array([float(r["r_max_nm"]) for r in rmax_rows], dtype=float)
    r_max = r_max[r_max > 0]
    fig, ax = plt.subplots(figsize=(5.6, 4.2))
    if r_max.size:
        n_bins = min(60, max(12, int(np.sqrt(r_max.size))))
        ax.hist(r_max, bins=n_bins, color="#0072b2", edgecolor="white",
                linewidth=0.4, alpha=0.9)
        ax.axvline(np.mean(r_max), color="#d55e00", ls="--", lw=1.4,
                   label=rf"mean = {np.mean(r_max):.2f} nm")
        ax.axvline(np.median(r_max), color="#333", ls=":", lw=1.3,
                   label=rf"median = {np.median(r_max):.2f} nm")
        ax.legend(loc="best", framealpha=0.92)
    ax.set_xlabel(r"maximum distance from centre  $r_{\mathrm{max}}$  (nm)")
    ax.set_ylabel("counts")
    ax.set_title(rf"Max separation (excl. LE emission, $N={{{r_max.size}}}$)")
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "rmax_hist.png"), dpi=300)
    plt.close(fig)

# CT emission distance (r at the photon)
ctr_path = os.path.join(outdir, "ct_emission_r.csv")
if os.path.isfile(ctr_path):
    ctr_rows = list(csv.DictReader(open(ctr_path)))
    r_ct = np.array([float(r["r_nm"]) for r in ctr_rows], dtype=float)
    fig, ax = plt.subplots(figsize=(5.6, 4.2))
    if r_ct.size:
        n_bins = min(60, max(12, int(np.sqrt(r_ct.size))))
        ax.hist(r_ct, bins=n_bins, color="#009e73", edgecolor="white",
                linewidth=0.4, alpha=0.9)
        ax.axvline(np.mean(r_ct), color="#d55e00", ls="--", lw=1.4,
                   label=rf"mean = {np.mean(r_ct):.2f} nm")
        ax.axvline(np.median(r_ct), color="#333", ls=":", lw=1.3,
                   label=rf"median = {np.median(r_ct):.2f} nm")
        ax.legend(loc="best", framealpha=0.92)
    ax.set_xlabel(r"CT emission distance  $r$  (nm)")
    ax.set_ylabel("counts")
    ax.set_title(rf"CT emission $r$ histogram ($N={{{r_ct.size}}}$)")
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "ct_emission_r_hist.png"), dpi=300)
    plt.close(fig)

# host–host hop distances (pre-binned in Julia; all hops counted)
hop_path = os.path.join(outdir, "hop_r.csv")
if os.path.isfile(hop_path):
    hop_rows = list(csv.DictReader(open(hop_path)))
    if hop_rows and "count" in hop_rows[0]:
        r_lo = np.array([float(r["r_lo_nm"]) for r in hop_rows], dtype=float)
        r_hi = np.array([float(r["r_hi_nm"]) for r in hop_rows], dtype=float)
        counts = np.array([float(r["count"]) for r in hop_rows], dtype=float)
        r_cent = 0.5 * (r_lo + r_hi)
        widths = r_hi - r_lo
        n_hop = int(counts.sum())
        mean_r = float(np.sum(r_cent * counts) / counts.sum()) if n_hop else float("nan")
        fig, ax = plt.subplots(figsize=(5.6, 4.2))
        if n_hop:
            ax.bar(r_lo, counts, width=widths, align="edge", color="#cc79a7",
                   edgecolor="white", linewidth=0.35, alpha=0.9)
            ax.axvline(mean_r, color="#d55e00", ls="--", lw=1.4,
                       label=rf"mean ≈ {mean_r:.2f} nm")
            ax.legend(loc="best", framealpha=0.92)
        ax.set_xlabel(r"host–host hop distance  $r_{\mathrm{hop}}$  (nm)")
        ax.set_ylabel("counts")
        ax.set_title(rf"Hopping distance histogram ($N={{{n_hop}}}$)")
        fig.tight_layout()
        fig.savefig(os.path.join(outdir, "hop_r_hist.png"), dpi=300)
        plt.close(fig)

# 3D morphology + sample trajectories
hosts_path = os.path.join(outdir, "morphology_hosts.csv")
centers_path = os.path.join(outdir, "morphology_centers.csv")
meta_path = os.path.join(outdir, "morphology_meta.csv")
paths_path = os.path.join(outdir, "sample_traj_paths.csv")
traj_meta_path = os.path.join(outdir, "sample_traj_meta.csv")
if os.path.isfile(hosts_path) and os.path.isfile(centers_path):
    from mpl_toolkits.mplot3d import Axes3D  # noqa: F401
    from matplotlib.colors import Normalize
    from matplotlib import cm

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
    # cube wireframe
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
    active_c = None
    if os.path.isfile(paths_path) and os.path.isfile(traj_meta_path):
        path_rows = list(csv.DictReader(open(paths_path)))
        tmeta = list(csv.DictReader(open(traj_meta_path)))
        if tmeta:
            active_c = int(float(tmeta[0]["c_idx"]))
            ax.scatter([cx[active_c - 1]], [cy[active_c - 1]], [cz[active_c - 1]],
                       c="k", s=100, marker="*", edgecolors="#f0f0f0",
                       linewidths=0.6, label=f"active centre {active_c}", zorder=6)

        # group path points by traj_id
        by_tid = {}
        for r in path_rows:
            tid = int(r["traj_id"])
            by_tid.setdefault(tid, []).append(r)

        outcome_seen = set()
        for tm in tmeta:
            tid = int(tm["traj_id"])
            outcome = tm["outcome"]
            pts = by_tid.get(tid, [])
            if not pts:
                continue
            xs = np.array([float(p["x_nm"]) for p in pts])
            ys = np.array([float(p["y_nm"]) for p in pts])
            zs = np.array([float(p["z_nm"]) for p in pts])
            # break segments that wrap across the periodic box
            col = traj_colors.get(outcome, "#333333")
            label = None
            if outcome not in outcome_seen:
                label = outcome.replace("_", " ")
                outcome_seen.add(outcome)
            # draw piecewise to avoid PBC chords
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
                    seg_x.append(xs[i]); seg_y.append(ys[i]); seg_z.append(zs[i])
            if len(seg_x) > 1:
                ax.plot(seg_x, seg_y, seg_z, color=col, lw=1.6, alpha=0.95, label=label)
            elif len(seg_x) == 1:
                ax.scatter(seg_x, seg_y, seg_z, c=col, s=35, depthshade=False, label=label)
            # mark end point
            ax.scatter([xs[-1]], [ys[-1]], [zs[-1]], c=col, s=40,
                       edgecolors="k", linewidths=0.4, depthshade=False, zorder=7)

    cb = fig.colorbar(sc, ax=ax, shrink=0.65, pad=0.08)
    cb.set_label("host LUMO (eV)")
    ax.set_xlim(0, Lbox); ax.set_ylim(0, Lbox); ax.set_zlim(0, Lbox)
    ax.set_xlabel("x (nm)"); ax.set_ylabel("y (nm)"); ax.set_zlabel("z (nm)")
    ax.set_title("Disordered box + sample trajectories")
    ax.legend(loc="upper left", fontsize=8, framealpha=0.9)
    try:
        ax.set_box_aspect((1, 1, 1))
    except Exception:
        pass
    fig.tight_layout()
    fig.savefig(os.path.join(outdir, "trajectories_3d.png"), dpi=300)
    plt.close(fig)

print("wrote figures to", outdir)
