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

fig, axes = plt.subplots(1, 2, figsize=(11.4, 4.7))

ax = axes[0]
m = I_tot > 0
if np.any(I_LE > 0):
    ax.loglog(t[I_LE > 0], I_LE[I_LE > 0], "-", color="#d55e00", lw=2.0, label=rf"LE emission  ($\phi={phi_LE:.3f}$)")
if np.any(I_CT > 0):
    ax.loglog(t[I_CT > 0], I_CT[I_CT > 0], "-", color="#0072b2", lw=2.0, label=rf"CT emission  ($\phi={phi_CT:.3f}$)")
if np.any(m):
    ax.loglog(t[m], I_tot[m], "--", color="#333", lw=1.2, alpha=0.8, label="total")
t_ref = np.logspace(-12, -6, 300)
# ax.loglog(t_ref, k_LE * np.exp(-k_LE * t_ref), ":", color="0.4", lw=1.2,
#           label=r"isolated LE  $k e^{-kt}$")
ax.set_xlabel("time (s)")
ax.set_ylabel(r"emission rate  $I(t)$  (s$^{-1}$ / trajectory)")
ax.set_title("Emission decay (log–log)")
ax.set_xlim(1e-12, float(summary.get("t_max", 1e-2)) if False else 1e-2)
ax.legend(loc="lower left", framealpha=0.92)

ax = axes[1]
# prompt window on a linear time axis (ns)
tmax_ns = 200.0
mask = (t > 0) & (t <= tmax_ns * 1e-9)
if np.any((I_LE > 0) & mask):
    m = mask & (I_LE > 0)
    ax.semilogy(t[m] * 1e9, I_LE[m], "-", color="#d55e00", lw=2.0, label="LE")
if np.any((I_CT > 0) & mask):
    m = mask & (I_CT > 0)
    ax.semilogy(t[m] * 1e9, I_CT[m], "-", color="#0072b2", lw=2.0, label="CT")
if np.any((I_tot > 0) & mask):
    m = mask & (I_tot > 0)
    ax.semilogy(t[m] * 1e9, I_tot[m], "--", color="#333", lw=1.2, label="total")
tt = np.linspace(0, tmax_ns, 400) * 1e-9
ax.semilogy(tt * 1e9, k_LE * np.exp(-k_LE * tt), ":", color="0.4", lw=1.2, label="isolated LE")
ax.set_xlabel("time (ns)")
ax.set_ylabel(r"emission rate  $I(t)$  (s$^{-1}$ / trajectory)")
ax.set_title("Prompt window")
ax.set_xlim(0, tmax_ns)
ax.set_ylim(1e0, 1e9)
ax.legend(loc="best", framealpha=0.92)

fig.suptitle(
    rf"LE / CT emission  |  $N={{{n_traj}}}$  |  "
    rf"$N_{{\mathrm{{host}}}}={{{int(float(summary['N_host']))}}}$, "
    rf"$L={{{float(summary['L_nm']):.1f}}}$ nm, "
    rf"$\tau_{{\mathrm{{LE}}}}={{{float(summary['tau_LE_s'])*1e9:.0f}}}$ ns, "
    rf"$\tau^{{0}}_{{\mathrm{{CT}}}}={{{float(summary['tau0_CT_s'])*1e9:.0f}}}$ ns",
    y=1.02,
)
fig.tight_layout()
fig.savefig(os.path.join(outdir, "emission_decay.png"))
fig.savefig(os.path.join(outdir, "emission_decay.pdf"))
plt.close(fig)

# separate panel: yields bar + mean hop stats text-free simple plot
fig, ax = plt.subplots(figsize=(5.2, 4.0))
ax.bar([0, 1], [phi_LE, phi_CT], color=["#d55e00", "#0072b2"], width=0.55)
ax.set_xticks([0, 1], ["LE emission", "CT emission"])
ax.set_ylabel("yield per trajectory")
ax.set_ylim(0, 1.05)
ax.set_title("Emission branching")
for i, v in enumerate([phi_LE, phi_CT]):
    ax.text(i, v + 0.03, f"{v:.3f}", ha="center", fontsize=10)
fig.tight_layout()
fig.savefig(os.path.join(outdir, "emission_yields.png"))
fig.savefig(os.path.join(outdir, "emission_yields.pdf"))
plt.close(fig)

print("wrote figures to", outdir)
