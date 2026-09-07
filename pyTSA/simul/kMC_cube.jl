#!/usr/bin/env julia
# Run with:  julia -t auto pyTSA/simul/kMC_cube.jl
#
# Kinetic Monte Carlo of geminate charge separation / hopping / recombination
# around a single charge-transfer (CT) centre in an organic semiconductor.
#
# Physics
# -------
# * One CT chromophore at the origin of a 3-D simple-cubic host lattice.
# * No energetic disorder (yet): every host molecule has the same site energy.
# * Hops are long-range within a cutoff radius R_HOP (lattice units), with
#   Miller–Abrahams tunneling  exp(−2 β r) and a Marcus activation energy.
# * t = 0: the CT is already excited (CT*).
# * CT* can
#     - decay to the ground state (photon from the centre), rate k_decay = 1/τ
#     - dissociate onto any lattice site within R_HOP (except the origin)
# * The counter-charge stays at the origin; the mobile polaron hops to any
#   site within R_HOP of its current position. Landing on the origin reforms
#   CT* (recombination), which may decay or separate again.
# * Charge-separation free-energy change is G0 = G(pair) − G(CT*).
#   Recombination has −G0. Host–host hops have ΔG = 0.
#   Activation energy:  Ea(ΔG) = (λ + ΔG)² / (4λ)
#   Rate:               k(r) = ν0 exp(−2 β r − Ea / kT)
#
# Detailed balance at fixed r: k_CS(r) / k_CR(r) = exp(−G0 / kT).

using Random
using Printf
using Base.Threads

# ---------------------------------------------------------------------------
# User parameters
# ---------------------------------------------------------------------------

const N_TRAJ      = 400_000
const LAMBDA_EV   = 1.0
const G0_LIST     = [0.40, 0.35, 0.30, 0.25, 0.20, 0.15, 0.10, 0.05, 0.00, -0.05, -0.10, -0.40]   # eV
const T_K         = 300.0
const NU0         = 1.0e13          # s⁻¹, Miller–Abrahams prefactor (as in LPLModel)
const BETA_INV_NM = 0.5             # nm⁻¹, inverse localisation length
const A_NM        = 1.0             # nm, lattice constant
const TAU_CT      = 1.0e-7          # s, CT* lifetime  (k_CT = 1e7 s⁻¹, LPLModel default)
const T_MAX       = 1.0e-2          # s
const R_HOP       = 4               # lattice units: max hop / CS / CR distance
const R_ESCAPE    = 40              # lattice units; beyond this the pair is free
const MAX_EVENTS  = 800_000
const SEED        = 1
const T_MIN_HIST  = 1.0e-12         # s
const N_BINS      = 90

const KB_EV = 8.617333262145e-5     # eV / K

const OUTDIR = joinpath(@__DIR__, "kmc_cube_output")

# ---------------------------------------------------------------------------
# Lattice geometry within R_HOP
# ---------------------------------------------------------------------------

struct Offset
    dx::Int16
    dy::Int16
    dz::Int16
    r_nm::Float64
end

"""All nonzero lattice vectors with |r| ≤ R_HOP (in lattice units)."""
function build_offsets(r_hop::Int, a_nm::Float64)
    offs = Offset[]
    r2max = r_hop * r_hop
    for dx in -r_hop:r_hop, dy in -r_hop:r_hop, dz in -r_hop:r_hop
        r2 = dx * dx + dy * dy + dz * dz
        (r2 == 0 || r2 > r2max) && continue
        push!(offs, Offset(Int16(dx), Int16(dy), Int16(dz), a_nm * sqrt(Float64(r2))))
    end
    # nearer sites first → slightly better branch prediction / early exits
    sort!(offs; by = o -> o.r_nm)
    return offs
end

const OFFSETS = build_offsets(R_HOP, A_NM)
const N_OFF   = length(OFFSETS)
const R_HOP_NM = A_NM * Float64(R_HOP)

# ---------------------------------------------------------------------------
# Rates
# ---------------------------------------------------------------------------

"""Marcus activation energy (eV)."""
marcus_Ea(λ::Float64, ΔG::Float64) = (λ + ΔG)^2 / (4λ)

"""Miller–Abrahams rate (s⁻¹) with a Marcus barrier at distance r (nm)."""
function miller_abrahams(ν0, β, r_nm, Ea, T)
    return ν0 * exp(-2 * β * r_nm - Ea / (KB_EV * T))
end

struct Rates
    G0::Float64
    λ::Float64
    Ea_cs::Float64
    Ea_cr::Float64
    Ea_hop::Float64
    k_decay::Float64
    k_cs::Vector{Float64}     # CS rate onto OFFSETS[i] from the origin
    k_cr::Vector{Float64}     # CR rate from OFFSETS[i] back to the origin
    k_hop::Vector{Float64}    # host hop of displacement OFFSETS[i]
    k_cs_tot::Float64
    k_cs_nn::Float64          # one nearest-neighbour CS channel (diagnostics)
    k_cr_nn::Float64
    k_hop_nn::Float64
    cum_cs::Vector{Float64}   # cumulative CS rates for fast sampling
end

function Rates(G0::Float64; λ::Float64 = LAMBDA_EV)
    Ea_cs  = marcus_Ea(λ, G0)
    Ea_cr  = marcus_Ea(λ, -G0)
    Ea_hop = marcus_Ea(λ, 0.0)
    k_decay = 1.0 / TAU_CT

    k_cs  = Vector{Float64}(undef, N_OFF)
    k_cr  = Vector{Float64}(undef, N_OFF)
    k_hop = Vector{Float64}(undef, N_OFF)
    cum_cs = Vector{Float64}(undef, N_OFF)

    @inbounds for i in 1:N_OFF
        r = OFFSETS[i].r_nm
        k_cs[i]  = miller_abrahams(NU0, BETA_INV_NM, r, Ea_cs,  T_K)
        k_cr[i]  = miller_abrahams(NU0, BETA_INV_NM, r, Ea_cr,  T_K)
        k_hop[i] = miller_abrahams(NU0, BETA_INV_NM, r, Ea_hop, T_K)
        cum_cs[i] = (i == 1 ? 0.0 : cum_cs[i - 1]) + k_cs[i]
    end
    k_cs_tot = cum_cs[end]

    # first shell: r = a (six sites); OFFSETS are sorted by r so index 1 is NN
    k_cs_nn  = k_cs[1]
    k_cr_nn  = k_cr[1]
    k_hop_nn = k_hop[1]

    return Rates(G0, λ, Ea_cs, Ea_cr, Ea_hop, k_decay,
                 k_cs, k_cr, k_hop, k_cs_tot, k_cs_nn, k_cr_nn, k_hop_nn, cum_cs)
end

"""CR rate from lattice site (x,y,z) to the origin, or 0 if out of R_HOP."""
function k_cr_from_site(r::Rates, x::Int, y::Int, z::Int)
    r2 = x * x + y * y + z * z
    r2 == 0 && return 0.0
    r2 > R_HOP * R_HOP && return 0.0
    r_nm = A_NM * sqrt(Float64(r2))
    return miller_abrahams(NU0, BETA_INV_NM, r_nm, r.Ea_cr, T_K)
end

# ---------------------------------------------------------------------------
# Single-trajectory Gillespie kMC
# ---------------------------------------------------------------------------

@enum Outcome emitted escaped timeout steplimit

struct Traj
    outcome::Outcome
    t::Float64
    n_cs::Int
    n_cr::Int
    n_hops::Int
    r2_max::Int
    t_first_cs::Float64
end

"""Sample index i with probability ∝ weights, given cumulative sums `cum` (cum[end] = total)."""
function sample_cum(cum::Vector{Float64}, rng)
    u = rand(rng) * cum[end]
    return searchsortedfirst(cum, u)
end

"""
One geminate pair, starting as CT*.

Long-range hops: every lattice site within R_HOP of the current position is a
possible destination. Landing on the origin is recombination (Marcus Ea_cr);
all other destinations are isoenergetic host hops (Ea_hop).
"""
function simulate_one(r::Rates, rng::AbstractRNG;
                      t_max::Float64 = T_MAX,
                      r_escape::Int = R_ESCAPE,
                      max_events::Int = MAX_EVENTS)

    exciton = true
    x = y = z = 0
    t = 0.0
    n_cs = 0
    n_cr = 0
    n_hops = 0
    r2_max = 0
    t_first_cs = NaN
    r_esc2 = r_escape * r_escape

    k_decay = r.k_decay
    k_hop = r.k_hop
    cum_cs = r.cum_cs
    offs = OFFSETS

    # scratch for polaron-step cumulative rates: [CR; hop_1 … hop_N]
    # hop channels that land on the origin are skipped (CR handles that)
    cum = Vector{Float64}(undef, N_OFF + 1)
    hop_idx = Vector{Int}(undef, N_OFF)   # OFFSETS index for each hop channel

    @inbounds for _ in 1:max_events
        if exciton
            k_tot = k_decay + r.k_cs_tot
            t += -log(rand(rng)) / k_tot
            if t > t_max
                return Traj(timeout, t_max, n_cs, n_cr, n_hops, r2_max, t_first_cs)
            end
            if rand(rng) * k_tot < k_decay
                return Traj(emitted, t, n_cs, n_cr, n_hops, r2_max, t_first_cs)
            end
            # charge separation onto a site sampled ∝ k_cs(r)
            i = sample_cum(cum_cs, rng)
            o = offs[i]
            x = Int(o.dx); y = Int(o.dy); z = Int(o.dz)
            exciton = false
            n_cs += 1
            r2 = x * x + y * y + z * z
            r2 > r2_max && (r2_max = r2)
            if isnan(t_first_cs)
                t_first_cs = t
            end
        else
            # --- build event list: CR (slot 1) + host hops (slots 2…) ---
            k_cr = k_cr_from_site(r, x, y, z)
            cum[1] = k_cr
            nchan = 1
            nhop = 0
            for i in 1:N_OFF
                o = offs[i]
                nx = x + Int(o.dx)
                ny = y + Int(o.dy)
                nz = z + Int(o.dz)
                if nx == 0 && ny == 0 && nz == 0
                    continue   # recombination already counted
                end
                nhop += 1
                nchan += 1
                hop_idx[nhop] = i
                cum[nchan] = cum[nchan - 1] + k_hop[i]
            end
            k_tot = cum[nchan]
            t += -log(rand(rng)) / k_tot
            if t > t_max
                return Traj(timeout, t_max, n_cs, n_cr, n_hops, r2_max, t_first_cs)
            end

            u = rand(rng) * k_tot
            j = searchsortedfirst(view(cum, 1:nchan), u)

            if j == 1
                # recombination → CT*
                exciton = true
                x = y = z = 0
                n_cr += 1
            else
                o = offs[hop_idx[j - 1]]
                x += Int(o.dx)
                y += Int(o.dy)
                z += Int(o.dz)
                n_hops += 1
                r2 = x * x + y * y + z * z
                r2 > r2_max && (r2_max = r2)
                if r2 > r_esc2
                    return Traj(escaped, t, n_cs, n_cr, n_hops, r2_max, t_first_cs)
                end
            end
        end
    end
    return Traj(steplimit, t, n_cs, n_cr, n_hops, r2_max, t_first_cs)
end

# ---------------------------------------------------------------------------
# Ensemble
# ---------------------------------------------------------------------------

struct Ensemble
    rates::Rates
    trajs::Vector{Traj}
    t_edges::Vector{Float64}
    t_cent::Vector{Float64}
    I_all::Vector{Float64}
    I_prompt::Vector{Float64}
    I_delayed::Vector{Float64}
    n_emitted::Int
    n_prompt::Int
    n_delayed::Int
    n_escaped::Int
    n_timeout::Int
    phi_em::Float64
    phi_cs::Float64
    phi_escape::Float64
    mean_n_cs::Float64
    mean_n_cr::Float64
    mean_n_hops::Float64
end

function log_bins(tmin, tmax, n)
    edges = 10 .^ range(log10(tmin), log10(tmax); length = n + 1)
    cent = sqrt.(edges[1:end-1] .* edges[2:end])
    return edges, cent
end

function histogram_times!(counts, edges, times)
    fill!(counts, 0)
    @inbounds for t in times
        j = searchsortedlast(edges, t)
        if 1 <= j < length(edges)
            counts[j] += 1
        elseif t == edges[end]
            counts[end] += 1
        end
    end
    return counts
end

function run_ensemble(r::Rates; n_traj::Int = N_TRAJ, seed::Int = SEED)
    trajs = Vector{Traj}(undef, n_traj)
    @threads for i in 1:n_traj
        rng = Xoshiro(seed + 1_000_003 * i)
        trajs[i] = simulate_one(r, rng)
    end

    t_emit_all     = Float64[]
    t_emit_prompt  = Float64[]
    t_emit_delayed = Float64[]
    sizehint!(t_emit_all, n_traj)
    n_emitted = 0
    n_prompt = 0
    n_delayed = 0
    n_escaped = 0
    n_timeout = 0
    n_cs_sum = 0
    n_cr_sum = 0
    n_hops_sum = 0
    n_did_cs = 0

    for tr in trajs
        n_cs_sum += tr.n_cs
        n_cr_sum += tr.n_cr
        n_hops_sum += tr.n_hops
        tr.n_cs > 0 && (n_did_cs += 1)
        if tr.outcome === emitted
            n_emitted += 1
            push!(t_emit_all, tr.t)
            if tr.n_cs == 0
                n_prompt += 1
                push!(t_emit_prompt, tr.t)
            else
                n_delayed += 1
                push!(t_emit_delayed, tr.t)
            end
        elseif tr.outcome === escaped
            n_escaped += 1
        else
            n_timeout += 1
        end
    end

    edges, cent = log_bins(T_MIN_HIST, T_MAX, N_BINS)
    dt = diff(edges)
    c_all = zeros(Int, N_BINS)
    c_pr  = zeros(Int, N_BINS)
    c_de  = zeros(Int, N_BINS)
    histogram_times!(c_all, edges, t_emit_all)
    histogram_times!(c_pr,  edges, t_emit_prompt)
    histogram_times!(c_de,  edges, t_emit_delayed)
    norm = Float64(n_traj)
    I_all     = c_all ./ (norm .* dt)
    I_prompt  = c_pr  ./ (norm .* dt)
    I_delayed = c_de  ./ (norm .* dt)

    return Ensemble(r, trajs, edges, cent, I_all, I_prompt, I_delayed,
                    n_emitted, n_prompt, n_delayed, n_escaped, n_timeout,
                    n_emitted / n_traj,
                    n_did_cs / n_traj,
                    n_escaped / n_traj,
                    n_cs_sum / n_traj,
                    n_cr_sum / n_traj,
                    n_hops_sum / n_traj)
end

# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------

function g0_tag(G0::Float64)
    s = @sprintf("%+.2f", G0)
    return replace(s, "+" => "p", "-" => "m", "." => "p")
end

function write_decay_csv(path, ensembles::Vector{Ensemble})
    open(path, "w") do io
        print(io, "t_s")
        for e in ensembles
            tag = g0_tag(e.rates.G0)
            print(io, ",I_all_G0$(tag),I_prompt_G0$(tag),I_delayed_G0$(tag)")
        end
        print(io, "\n")
        n = length(ensembles[1].t_cent)
        for i in 1:n
            @printf(io, "%.8e", ensembles[1].t_cent[i])
            for e in ensembles
                @printf(io, ",%.8e,%.8e,%.8e", e.I_all[i], e.I_prompt[i], e.I_delayed[i])
            end
            print(io, "\n")
        end
    end
end

function write_summary_csv(path, ensembles::Vector{Ensemble})
    open(path, "w") do io
        println(io, "G0_eV,lambda_eV,Ea_cs_eV,Ea_cr_eV,Ea_hop_eV,k_decay,k_cs_nn,k_cr_nn,k_hop_nn,k_cs_tot,n_offsets,R_hop,phi_prompt_theory,phi_em,phi_prompt,phi_delayed,phi_cs,phi_escape,mean_n_cs,mean_n_cr,mean_n_hops,n_emitted,n_prompt,n_delayed,n_escaped,n_timeout")
        for e in ensembles
            r = e.rates
            k_exc = r.k_decay + r.k_cs_tot
            phi_pr_th = r.k_decay / k_exc
            @printf(io,
                "%.5f,%.5f,%.6f,%.6f,%.6f,%.6e,%.6e,%.6e,%.6e,%.6e,%d,%d,%.6e,%.6e,%.6e,%.6e,%.6e,%.6e,%.6e,%.6e,%.6e,%d,%d,%d,%d,%d\n",
                r.G0, r.λ, r.Ea_cs, r.Ea_cr, r.Ea_hop,
                r.k_decay, r.k_cs_nn, r.k_cr_nn, r.k_hop_nn, r.k_cs_tot, N_OFF, R_HOP, phi_pr_th,
                e.phi_em, e.n_prompt / length(e.trajs), e.n_delayed / length(e.trajs),
                e.phi_cs, e.phi_escape, e.mean_n_cs, e.mean_n_cr, e.mean_n_hops,
                e.n_emitted, e.n_prompt, e.n_delayed, e.n_escaped, e.n_timeout)
        end
    end
end

function print_rates(r::Rates)
    k_exc = r.k_decay + r.k_cs_tot
    @printf("  G0 = %+5.2f eV   Ea_CS = %.3f eV   Ea_CR = %.3f eV   Ea_hop = %.3f eV\n",
            r.G0, r.Ea_cs, r.Ea_cr, r.Ea_hop)
    @printf("    k_decay = %.3e   k_CS(NN) = %.3e   Σ k_CS (%d sites) = %.3e\n",
            r.k_decay, r.k_cs_nn, N_OFF, r.k_cs_tot)
    @printf("    k_CR(NN) = %.3e   k_hop(NN) = %.3e   φ_prompt(th) = %.3e\n",
            r.k_cr_nn, r.k_hop_nn, r.k_decay / k_exc)
    @printf("    k_CS(NN)/k_CR(NN) = %.3e  (exp(-G0/kT)=%.3e)\n",
            r.k_cs_nn / r.k_cr_nn, exp(-r.G0 / (KB_EV * T_K)))
end

function print_ensemble(e::Ensemble)
    @printf("    emitted %d  (prompt %d, delayed %d)   escaped %d   timeout/limit %d\n",
            e.n_emitted, e.n_prompt, e.n_delayed, e.n_escaped, e.n_timeout)
    @printf("    φ_em = %.4f   φ_CS = %.4f   φ_escape = %.4f   ⟨n_CS⟩ = %.3f   ⟨n_CR⟩ = %.3f   ⟨n_hops⟩ = %.1f\n",
            e.phi_em, e.phi_cs, e.phi_escape, e.mean_n_cs, e.mean_n_cr, e.mean_n_hops)
end

# ---------------------------------------------------------------------------
# Plotting (matplotlib via Python — already a dependency of pyTSA)
# ---------------------------------------------------------------------------

const PLOT_PY = raw"""
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
g0s = [float(r["G0_eV"]) for r in sum_rows]
g0_min, g0_max = min(g0s), max(g0s)
if g0_max <= g0_min:
    g0_min, g0_max = g0_min - 0.1, g0_max + 0.1

def color_of(g0):
    # uphill CS (positive G0) = warm; downhill = cool
    x = (g0 - g0_min) / (g0_max - g0_min)
    return cmap(np.clip(x, 0, 1))

k_decay = float(sum_rows[0]["k_decay"])
r_hop = int(float(sum_rows[0]["R_hop"]))
n_off = int(float(sum_rows[0]["n_offsets"]))
t_ref = np.logspace(-12, -5, 400)

plt.rcParams.update({
    "font.size": 11,
    "axes.labelsize": 12,
    "legend.fontsize": 7.5,
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
        ax.loglog(t[m], I[m], "-", lw=1.7, color=c, label=rf"$\Delta G_0 = {g0:+.2f}$ eV")
    else:
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
ax.legend(loc="lower left", framealpha=0.92, fontsize=6.8)

ax = axes[1]
for r in sum_rows:
    g0 = float(r["G0_eV"])
    I = col(g0, "I_all_")
    m = (t >= 1e-12) & (t <= 2e-6) & (I > 0)
    if np.any(m):
        ax.semilogy(t[m] * 1e9, I[m], "-", lw=1.7, color=color_of(g0),
                    label=rf"$\Delta G_0 = {g0:+.2f}$ eV")
ax.semilogy(t_ref * 1e9, k_decay * np.exp(-k_decay * t_ref), "k--", lw=1.0, alpha=0.7)
ax.set_xlabel("time (ns)")
ax.set_ylabel(r"emission rate  $I(t)$  (s$^{-1}$ / trajectory)")
ax.set_title("Prompt window")
ax.set_xlim(0, 800)
ax.set_ylim(1e2, 3e8)
fig.suptitle(
    rf"kMC long-range hops  |  $R_{{\mathrm{{hop}}}}={r_hop}$ ({n_off} sites)  |  "
    rf"$\lambda=1$ eV, $T=300$ K, $\tau_{{\mathrm{{CT}}}}=100$ ns",
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
        ax.loglog(t[mp], Ip[mp], "-", lw=1.5, color=c,
                  label=rf"prompt  $\Delta G_0={g0:+.2f}$")
    if np.any(md):
        ax.loglog(t[md], Id[md], "--", lw=1.5, color=c,
                  label=rf"delayed $\Delta G_0={g0:+.2f}$")
ax.set_xlabel("time (s)")
ax.set_ylabel(r"emission rate  $I(t)$  (s$^{-1}$ / trajectory)")
ax.set_title("Prompt (no hop) vs delayed (after CS/CR)")
ax.set_xlim(1e-12, 1e-2)
ax.legend(loc="lower left", ncol=2, fontsize=6.2, framealpha=0.92)

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
ax.set_title(rf"Yields vs $\Delta G_0$  ($\lambda=1$ eV, $R_{{\mathrm{{hop}}}}={r_hop}$)")
ax.set_ylim(-0.05, 1.12)
ax.legend(loc="center left", fontsize=8)
fig.tight_layout()
fig.savefig(os.path.join(outdir, "yields_prompt_delayed.png"))
fig.savefig(os.path.join(outdir, "yields_prompt_delayed.pdf"))
plt.close(fig)

# ---- Figure 3: rates + hopping statistics ----
fig, axes = plt.subplots(1, 2, figsize=(11.4, 4.7))
ax = axes[0]
k_cs_tot = np.array([float(r["k_cs_tot"]) for r in sum_rows])[order]
k_cr_nn = np.array([float(r["k_cr_nn"]) for r in sum_rows])[order]
k_hop_nn = np.array([float(r["k_hop_nn"]) for r in sum_rows])[order]
g = g0a[order]
ax.semilogy(g, k_cs_tot, "o-", color="#d55e00", lw=1.6, label=r"$\sum k_{\mathrm{CS}}$  (all sites $\leq R_{\mathrm{hop}}$)")
ax.semilogy(g, k_cr_nn, "s-", color="#0072b2", lw=1.6, label=r"$k_{\mathrm{CR}}$(NN)")
ax.semilogy(g, k_hop_nn, "D--", color="#009e73", lw=1.4, label=r"$k_{\mathrm{hop}}$(NN)")
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
"""

function plot_with_python(outdir::String)
    pyfile = joinpath(outdir, "_plot_kmc.py")
    write(pyfile, PLOT_PY)
    env = copy(ENV)
    env["MPLCONFIGDIR"] = joinpath(outdir, ".mplconfig")
    mkpath(env["MPLCONFIGDIR"])
    run(setenv(`python3 $pyfile $outdir`, env))
end

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

function main()
    mkpath(OUTDIR)
    println("============================================================")
    println("  kMC hopping around a single CT centre  (long-range)")
    println("============================================================")
    @printf("  λ = %.2f eV    T = %.0f K    τ_CT = %.2e s    a = %.1f nm    β = %.1f nm⁻¹\n",
            LAMBDA_EV, T_K, TAU_CT, A_NM, BETA_INV_NM)
    @printf("  ν0 = %.2e s⁻¹    N_traj = %d    threads = %d\n",
            NU0, N_TRAJ, nthreads())
    @printf("  R_hop = %d  (%d sites)    R_escape = %d\n", R_HOP, N_OFF, R_ESCAPE)
    println()
    println("  Marcus barriers  Ea = (λ + ΔG)² / 4λ")
    println("    CS:  ΔG = +G0      CR:  ΔG = −G0      host hop: ΔG = 0")
    println("  Rate k(r) = ν0 exp(−2 β r − Ea/kT)  for all |r| ≤ R_hop")
    println()

    ensembles = Ensemble[]
    for G0 in G0_LIST
        r = Rates(Float64(G0))
        print_rates(r)
        print("  running … ")
        flush(stdout)
        t0 = time()
        e = run_ensemble(r)
        @printf("done in %.1f s\n", time() - t0)
        print_ensemble(e)
        println()
        push!(ensembles, e)
    end

    decay_csv = joinpath(OUTDIR, "decay_curves.csv")
    sum_csv   = joinpath(OUTDIR, "summary.csv")
    write_decay_csv(decay_csv, ensembles)
    write_summary_csv(sum_csv, ensembles)
    println("  wrote ", decay_csv)
    println("  wrote ", sum_csv)

    println("  plotting …")
    plot_with_python(OUTDIR)
    println("  figures: decay_curves.{png,pdf}  yields_prompt_delayed.{png,pdf}  rates_and_hops.{png,pdf}")
    println("============================================================")
    return ensembles
end

if abspath(PROGRAM_FILE) == @__FILE__
    main()
end
