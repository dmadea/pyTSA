import csv
import os
import sys
import matplotlib
matplotlib.use("Agg")
import numpy as np
import matplotlib.pyplot as plt

outdir = sys.argv[1]
decay_path = os.path.join(outdir, "decay_curves.csv")
sum_path = os.path.join(outdir, "summary.csv")

def read_csv(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))

def g0_tag(g0):
    s = f"{float(g0):+.2f}"
    return s.replace("+", "p").replace("-", "m").replace(".", "p")

decay_rows = read_csv(decay_path)
sum_rows = read_csv(sum_path)
t = np.array([float(r["t_s"]) for r in decay_rows])

def col(g0, prefix):
    key = f"{prefix}G0{g0_tag(g0)}"
    return np.array([float(r[key]) for r in decay_rows])

cmap = plt.get_cmap("coolwarm")
g0_min, g0_max = -1.0, 0.40

def color_of(g0):
    # uphill CS (positive G0) = warm; barrierless / downhill = cool
    x = (g0 - g0_min) / (g0_max - g0_min)
    return cmap(np.clip(x, 0, 1))

k_decay = float(sum_rows[0]["k_decay"])
t_ref = np.logspace(-12, -5, 400)

plt.rcParams.update({
    "font.size": 11,
    "axes.labelsize": 12,
    "legend.fontsize": 8.0,
    "figure.dpi": 140,
    "savefig.bbox": "tight",
    "axes.grid": True,
    "grid.alpha": 0.35,
})

def prompt_theory(r, tt):
    kexc = float(r["k_decay"]) + float(r["k_cs_tot"])
    return float(r["k_decay"]) * np.exp(-kexc * tt)

# ---- Figure 1: emission decay (main result) ----
fig, axes = plt.subplots(1, 2, figsize=(11.4, 4.7))

ax = axes[0]
for r in sum_rows:
    g0 = float(r["G0_eV"])
    I = col(g0, "I_all_")
    c = color_of(g0)
    m = I > 0
    if np.any(m):
        ax.loglog(t[m], I[m], "-", lw=1.9, color=c, label=rf"$\Delta G_0 = {g0:+.2f}$ eV")
    else:
        # downhill / barrierless: histogram is empty; show competing-rate prompt
        tt = np.logspace(-13, -9, 80)
        Ip = prompt_theory(r, tt)
        ax.loglog(tt, Ip, ":", lw=1.4, color=c, alpha=0.85,
                  label=rf"$\Delta G_0 = {g0:+.2f}$ eV  (theory, $\phi\sim 0$)")
ax.loglog(t_ref, k_decay * np.exp(-k_decay * t_ref), "k--", lw=1.0, alpha=0.7,
          label=r"isolated CT*  $k e^{-kt}$")
ax.set_xlabel("time (s)")
ax.set_ylabel(r"emission rate  $I(t)$  (s$^{-1}$ / trajectory)")
ax.set_title("CT-centre emission decay")
ax.set_xlim(1e-13, 1e-2)
ax.set_ylim(1e-2, 3e8)
ax.legend(loc="lower left", framealpha=0.92, fontsize=7.5)

ax = axes[1]
for r in sum_rows:
    g0 = float(r["G0_eV"])
    I = col(g0, "I_all_")
    m = (t >= 1e-12) & (t <= 2e-6) & (I > 0)
    if np.any(m):
        ax.semilogy(t[m] * 1e9, I[m], "-", lw=1.9, color=color_of(g0),
                    label=rf"$\Delta G_0 = {g0:+.2f}$ eV")
ax.semilogy(t_ref * 1e9, k_decay * np.exp(-k_decay * t_ref), "k--", lw=1.0, alpha=0.7)
ax.set_xlabel("time (ns)")
ax.set_ylabel(r"emission rate  $I(t)$  (s$^{-1}$ / trajectory)")
ax.set_title("Prompt window")
ax.set_xlim(0, 800)
ax.set_ylim(1e2, 3e8)
fig.suptitle(r"kMC hopping around one CT  |  $\lambda = 1$ eV,  $T = 300$ K,  $\tau_{\mathrm{CT}} = 100$ ns",
             y=1.03)
fig.tight_layout()
fig.savefig(os.path.join(outdir, "decay_curves.png"))
fig.savefig(os.path.join(outdir, "decay_curves.pdf"))
plt.close(fig)

# ---- Figure 2: prompt vs delayed + yields ----
fig, axes = plt.subplots(1, 2, figsize=(11.4, 4.7))
ax = axes[0]
for r in sum_rows:
    g0 = float(r["G0_eV"])
    Ip = col(g0, "I_prompt_")
    Id = col(g0, "I_delayed_")
    c = color_of(g0)
    mp, md = Ip > 0, Id > 0
    if np.any(mp):
        ax.loglog(t[mp], Ip[mp], "-", lw=1.6, color=c,
                  label=rf"prompt  $\Delta G_0={g0:+.2f}$")
    if np.any(md):
        ax.loglog(t[md], Id[md], "--", lw=1.6, color=c,
                  label=rf"delayed $\Delta G_0={g0:+.2f}$")
ax.set_xlabel("time (s)")
ax.set_ylabel(r"emission rate  $I(t)$  (s$^{-1}$ / trajectory)")
ax.set_title("Prompt (no hop) vs delayed (after CS/CR)")
ax.set_xlim(1e-12, 1e-2)
ax.legend(loc="lower left", ncol=2, fontsize=7.0, framealpha=0.92)

ax = axes[1]
g0a = np.array([float(r["G0_eV"]) for r in sum_rows])
phi_em = np.array([float(r["phi_em"]) for r in sum_rows])
phi_pr = np.array([float(r["phi_prompt"]) for r in sum_rows])
phi_de = np.array([float(r["phi_delayed"]) for r in sum_rows])
phi_cs = np.array([float(r["phi_cs"]) for r in sum_rows])
phi_esc = np.array([float(r["phi_escape"]) for r in sum_rows])
phi_pr_th = np.array([float(r["phi_prompt_theory"]) for r in sum_rows])
order = np.argsort(g0a)
ax.plot(g0a[order], phi_em[order], "o-", color="#222", lw=1.8, label=r"emission $\phi_{\mathrm{em}}$")
ax.plot(g0a[order], phi_pr[order], "s--", color="#d55e00", lw=1.4, label="prompt emission")
ax.plot(g0a[order], phi_de[order], "^--", color="#0072b2", lw=1.4, label="delayed emission")
ax.plot(g0a[order], phi_cs[order], "D-.", color="#009e73", lw=1.4, label="ever separated")
ax.plot(g0a[order], phi_esc[order], "v:", color="#882255", lw=1.4, label="escaped as free charges")
ax.plot(g0a[order], phi_pr_th[order], "k:", lw=1.0, alpha=0.7, label=r"$\phi_{\mathrm{prompt}}^{\mathrm{th}}$")
ax.set_xlabel(r"$\Delta G_0$ of charge separation (eV)")
ax.set_ylabel("yield  (per trajectory)")
ax.set_title(r"Yields vs $\Delta G_0$  ($\lambda = 1$ eV)")
ax.set_ylim(-0.05, 1.12)
ax.axvline(-1.0, color="0.5", ls=":", lw=0.9)
ax.text(-1.0, 1.04, r"barrierless CS" + "\n" + r"($G_0=-\lambda$)",
        ha="center", va="bottom", fontsize=8, color="0.35")
ax.legend(loc="center left", fontsize=8)
fig.tight_layout()
fig.savefig(os.path.join(outdir, "yields_prompt_delayed.png"))
fig.savefig(os.path.join(outdir, "yields_prompt_delayed.pdf"))
plt.close(fig)

# ---- Figure 3: rates + hopping statistics ----
fig, axes = plt.subplots(1, 2, figsize=(11.4, 4.7))
ax = axes[0]
k_cs = np.array([float(r["k_cs"]) for r in sum_rows])[order]
k_cr = np.array([float(r["k_cr"]) for r in sum_rows])[order]
k_hop = np.array([float(r["k_hop"]) for r in sum_rows])[order]
g = g0a[order]
ax.semilogy(g, 6 * k_cs, "o-", color="#d55e00", lw=1.6, label=r"$6 k_{\mathrm{CS}}$  (total separation)")
ax.semilogy(g, k_cr, "s-", color="#0072b2", lw=1.6, label=r"$k_{\mathrm{CR}}$  (NN recombination)")
ax.semilogy(g, k_hop, "D--", color="#009e73", lw=1.4, label=r"$k_{\mathrm{hop}}$  ($\Delta G=0$)")
ax.axhline(k_decay, color="k", ls=":", lw=1.2, label=r"$k_{\mathrm{decay}} = 1/\tau$")
ax.set_xlabel(r"$\Delta G_0$ of charge separation (eV)")
ax.set_ylabel(r"rate (s$^{-1}$)")
ax.set_title("Marcus / Miller–Abrahams rates")
ax.legend(loc="best", fontsize=8)

ax = axes[1]
mean_cs = np.array([float(r["mean_n_cs"]) for r in sum_rows])[order]
mean_cr = np.array([float(r["mean_n_cr"]) for r in sum_rows])[order]
mean_h = np.array([float(r["mean_n_hops"]) for r in sum_rows])[order]
ax.semilogy(g, np.maximum(mean_cs, 1e-4), "o-", color="#d55e00", lw=1.6, label=r"$\langle n_{\mathrm{CS}}\rangle$")
ax.semilogy(g, np.maximum(mean_cr, 1e-4), "s-", color="#0072b2", lw=1.6, label=r"$\langle n_{\mathrm{CR}}\rangle$")
ax.semilogy(g, np.maximum(mean_h, 1e-4), "D--", color="#009e73", lw=1.4, label=r"$\langle n_{\mathrm{hops}}\rangle$")
ax.set_xlabel(r"$\Delta G_0$ of charge separation (eV)")
ax.set_ylabel("mean count per trajectory")
ax.set_title("Separation, recombination, host hops")
ax.legend(loc="best", fontsize=8)
fig.tight_layout()
fig.savefig(os.path.join(outdir, "rates_and_hops.png"))
fig.savefig(os.path.join(outdir, "rates_and_hops.pdf"))
plt.close(fig)

print("wrote figures to", outdir)
