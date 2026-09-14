#!/usr/bin/env julia
# Prefer:  julia -t auto pyTSA/simul/kMC_cube_full.jl
# (Julia's thread count is fixed at startup; default is 1 thread.)
# If started with 1 thread, this script re-launches itself with -t auto.
# Kinetic Monte Carlo of geminate charge separation / hopping / recombination
# around a single charge-transfer (CT) centre in an organic semiconductor.

# generates the random positions in a box
# then assign the centers and energies of hosts or other dopants
# simulates the full LE emission, and CT formation and emission and CS from CT state
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

const AVOGADRO = 6.02214076e23
const KB_EV = 8.617333262145e-5     # eV / K
const EPS_0 = 8.854187e-12
const E_CHARGE = 1.602176634e-19

const M            = 192.17  # g/mol for PET
const HOST_DENSITY = 1.332 # g/cm^3, density of PET
const DENSITY      = HOST_DENSITY * AVOGADRO * 1e-21 / M # in units / nm3

const N_TRAJ      = 200_000   # 2_000_000
const LAMBDA_EV   = 1.0
const N_PARTICLES = 2_000
const L           = (N_PARTICLES / DENSITY)^(1/3) # in nm
const EPS_HOST    = 3.2
const C_CENTERS   = 0.02   # 1% conc.
const T_K         = 100.0
const NU0         = 1.0e13          # s⁻¹, Miller–Abrahams prefactor (as in LPLModel)
const BETA_INV_NM = 0.5             # nm⁻¹, inverse localisation length for hopping 
const BETA_INV_TAU_CT_NM = 1.0      # nm⁻¹, inverse localisation length for CT emission rate
const A_NM        = 1.0             # nm, lattice constant
const TAU_LE      = 1.0e-8          # s, LE lifetime  (k_LE = 1e8 s⁻¹, LPLModel default)
const TAU0_CT     = 1.0e-6         # s, CT* lifetime for zero separation distance
const T_MAX       = 1.0e-2          # s
const MAX_EVENTS  = 80_000
const SEED        = 1
const T_MIN_HIST  = 1.0e-12         # s
const N_BINS      = 90

const COULOUMB_CONST = E_CHARGE * 1e9 / (4 * π * EPS_0 * EPS_HOST)  # in eV.nm

# ('$\\alpha$NPD', -5.2, -2.1, red),
# ('BP2DPA',	-5.65, -2.74, red),
# ('4CzIPN',	-5.8	, -3.4, red),
# ('HAP-3TPA',	-5.56, -3.31, red),
# ('PET', -7.11, -3.06, blue), # band gap 306 nm

const HOMO_CENTER = -5.65
const LUMO_CENTER = -2.74

const HOMO_HOST = -7.11
const LUMO_HOST = -5.8

const OUTDIR = joinpath(@__DIR__, "kmc_cube_full_output")
const R_MIN_NM = 0.2   # nm; floor for Coulomb / tunneling distances
const N_RATES  = 40    # top hop channels kept per (centre, host) pair
const LUMO_STD_HOST = 0.1
const LUMO_STD_CENTER = 0.0
const HOMO_STD_CENTER = 0.0

"""Marcus activation energy (eV)."""
marcus_Ea(λ::Float64, ΔG::Float64) = (λ + ΔG)^2 / (4λ)

"""Miller–Abrahams rate (s⁻¹) with a Marcus barrier at distance r (nm)."""
function miller_abrahams(ν0, β, r_nm, Ea, T)
    return ν0 * exp(-2 * β * r_nm - Ea / (KB_EV * T))
end

"""Minimum-image distance (nm) between two points in a cubic box of side `Lbox`."""
function dist_pbc(r1::AbstractVector{<:Real}, r2::AbstractVector{<:Real}, Lbox::Float64)
    dx = r1[1] - r2[1]
    dy = r1[2] - r2[2]
    dz = r1[3] - r2[3]
    dx -= Lbox * round(dx / Lbox)
    dy -= Lbox * round(dy / Lbox)
    dz -= Lbox * round(dz / Lbox)
    return sqrt(dx * dx + dy * dy + dz * dz)
end

"""Optical LE energy of the centre (eV): E_LUMO − E_HOMO."""
E_LE(E_LUMO_c::Float64, E_HOMO_c::Float64) = E_LUMO_c - E_HOMO_c

"""
CT energy (eV) for hole on centre HOMO and electron on host LUMO:
E_CT = −HOMO_c + LUMO_h − C/r  (IP−EA−Coulomb with orbital energies < 0).
"""
function E_CT_pair(E_HOMO_c::Float64, E_LUMO_h::Float64, r_nm::Float64)
    r = max(r_nm, R_MIN_NM)
    return -E_HOMO_c + E_LUMO_h - COULOUMB_CONST / r
end


# ---------------------------------------------------------------------------
# Shared morphology + precomputed rates (built once per ensemble)
# ---------------------------------------------------------------------------

@enum Outcome LE_emission CT_emission timeout steplimit
@enum State LE hopping

struct Traj
    outcome::Outcome
    t::Float64
    n_cr::Int
    n_cs::Int
    n_hops::Int
    r2_max::Int
    t_first_cs::Float64
    c_idx::Int
end

"""
Precomputed disordered box used by all trajectories.

Hop / CS / CR rates depend on which centre holds the hole (Coulomb), so tables
are stored per centre. Each trajectory only draws `c_idx` and runs Gillespie.
"""
struct System
    Lbox::Float64
    n_host::Int
    n_centers::Int
    xyz_host::Matrix{Float64}          # (N, 3)
    xyz_centers::Matrix{Float64}       # (Nc, 3)
    host_LUMO::Vector{Float64}
    center_LUMO::Vector{Float64}
    center_HOMO::Vector{Float64}
    E_le::Vector{Float64}              # (Nc,)
    r_host_ct::Matrix{Float64}         # (Nc, N)  centre–host distance
    rates_ct::Matrix{Float64}          # (Nc, N)  LE → CT onto host
    rates_ct_cum::Matrix{Float64}      # (Nc, N)
    rates_cr::Matrix{Float64}          # (Nc, N)  CT → LE from host
    rates_ct_emit::Matrix{Float64}     # (Nc, N)  CT emission from host
    rate_table::Array{Float64,3}       # (Nc, N, N_RATES)
    rate_table_cumsums::Array{Float64,3}
    rate_table_indexes::Array{Int,3}
    k_LE::Float64
end

"""Sample index i with probability ∝ weights, given cumulative sums `cum`."""
function sample_cum(cum::AbstractVector{Float64}, rng)
    u = rand(rng) * cum[end]
    return searchsortedfirst(cum, u)
end

"""Build one periodic box and precompute rates for every centre."""
function build_system(rng::AbstractRNG;
                      n_host::Int = N_PARTICLES,
                      Lbox::Float64 = Float64(L))
    n_centers = max(1, round(Int, n_host * C_CENTERS))
    k_LE = 1.0 / TAU_LE
    k_CT0 = 1.0 / TAU0_CT

    xyz_host = rand(rng, n_host, 3) .* Lbox
    xyz_centers = rand(rng, n_centers, 3) .* Lbox
    host_LUMO = LUMO_HOST .+ LUMO_STD_HOST .* randn(rng, n_host)
    center_LUMO = LUMO_CENTER .+ LUMO_STD_CENTER .* randn(rng, n_centers)
    center_HOMO = HOMO_CENTER .+ HOMO_STD_CENTER .* randn(rng, n_centers)
    E_le = E_LE.(center_LUMO, center_HOMO)

    # host–host distances (symmetric, diagonal unused)
    r_hh = Matrix{Float64}(undef, n_host, n_host)
    @inbounds for i in 1:n_host
        r_hh[i, i] = 0.0
        xi = @view xyz_host[i, :]
        for j in (i + 1):n_host
            rij = max(dist_pbc(xi, @view(xyz_host[j, :]), Lbox), R_MIN_NM)
            r_hh[i, j] = rij
            r_hh[j, i] = rij
        end
    end

    r_host_ct = Matrix{Float64}(undef, n_centers, n_host)
    rates_ct = Matrix{Float64}(undef, n_centers, n_host)
    rates_ct_cum = Matrix{Float64}(undef, n_centers, n_host)
    rates_cr = Matrix{Float64}(undef, n_centers, n_host)
    rates_ct_emit = Matrix{Float64}(undef, n_centers, n_host)
    rate_table = Array{Float64,3}(undef, n_centers, n_host, N_RATES)
    rate_table_cumsums = Array{Float64,3}(undef, n_centers, n_host, N_RATES)
    rate_table_indexes = Array{Int,3}(undef, n_centers, n_host, N_RATES)

    # fill per-centre tables (threaded over centres)
    @threads for c in 1:n_centers
        rates_hop_full = Vector{Float64}(undef, n_host)
        xc = @view xyz_centers[c, :]
        Ele = E_le[c]
        EHc = center_HOMO[c]

        # CS and CR rates
        @inbounds for i in 1:n_host
            r_nm = max(dist_pbc(xc, @view(xyz_host[i, :]), Lbox), R_MIN_NM)
            r_host_ct[c, i] = r_nm
            E_ct = E_CT_pair(EHc, host_LUMO[i], r_nm)
            dG_cs = E_ct - Ele
            rates_ct[c, i] = miller_abrahams(NU0, BETA_INV_NM, r_nm,
                                             marcus_Ea(LAMBDA_EV, dG_cs), T_K)
            rates_cr[c, i] = miller_abrahams(NU0, BETA_INV_NM, r_nm,
                                             marcus_Ea(LAMBDA_EV, -dG_cs), T_K)
            rates_ct_emit[c, i] = k_CT0 * exp(-BETA_INV_TAU_CT_NM * r_nm)
            rates_ct_cum[c, i] = (i == 1 ? 0.0 : rates_ct_cum[c, i - 1]) + rates_ct[c, i]
        end

        # hopping rates
        @inbounds for i in 1:n_host
            r_i = r_host_ct[c, i]
            E_i = host_LUMO[i] - COULOUMB_CONST / r_i
            for j in 1:n_host
                if i == j
                    rates_hop_full[j] = 0.0
                else
                    dG = (host_LUMO[j] - COULOUMB_CONST / r_host_ct[c, j]) - E_i
                    rates_hop_full[j] = miller_abrahams(NU0, BETA_INV_NM, r_hh[i, j],
                                                        marcus_Ea(LAMBDA_EV, dG), T_K)
                end
            end
            top = partialsortperm(rates_hop_full, 1:N_RATES; rev=true)
            for k in 1:N_RATES
                dest = top[k]
                rate_table_indexes[c, i, k] = dest
                rate_table[c, i, k] = rates_hop_full[dest]
                rate_table_cumsums[c, i, k] = (k == 1 ? 0.0 : rate_table_cumsums[c, i, k - 1]) + rate_table[c, i, k]
            end
        end
    end

    return System(Lbox, n_host, n_centers, xyz_host, xyz_centers,
                  host_LUMO, center_LUMO, center_HOMO, E_le, r_host_ct,
                  rates_ct, rates_ct_cum, rates_cr, rates_ct_emit,
                  rate_table, rate_table_cumsums, rate_table_indexes, k_LE)
end

"""
One trajectory on a shared `System`: pick a random centre, start as LE, Gillespie.
"""
function simulate_one(sys::System, rng::AbstractRNG;
                      t_max::Float64 = T_MAX,
                      max_events::Int = MAX_EVENTS)
    c = rand(rng, 1:sys.n_centers)
    k_LE = sys.k_LE
    rates_cum = Vector{Float64}(undef, N_RATES + 2)

    state = LE
    h_idx = 1
    t = 0.0
    n_cs = 0
    n_cr = 0
    n_hops = 0
    r2_max = 0
    t_first_cs = NaN

    @inbounds for _ in 1:max_events
        if state === LE
            k_tot = k_LE + sys.rates_ct_cum[c, end]
            t += -log(rand(rng)) / k_tot
            if t > t_max
                return Traj(timeout, t_max, n_cr, n_cs, n_hops, r2_max, t_first_cs, c)
            end
            if rand(rng) * k_tot < k_LE
                return Traj(LE_emission, t, n_cr, n_cs, n_hops, r2_max, t_first_cs, c)
            end
            # sample host from this centre's CS cumsum
            u = rand(rng) * sys.rates_ct_cum[c, end]
            h_idx = searchsortedfirst(@view(sys.rates_ct_cum[c, :]), u)
            state = hopping
            n_cs += 1
            if isnan(t_first_cs)
                t_first_cs = t
            end
            r_ct0 = sys.r_host_ct[c, h_idx]
            r2 = round(Int, r_ct0 * r_ct0)
            r2 > r2_max && (r2_max = r2)
        else
            rate_cr = sys.rates_cr[c, h_idx]
            rate_CT_emit = sys.rates_ct_emit[c, h_idx]

            copyto!(rates_cum, 1, @view(sys.rate_table_cumsums[c, h_idx, :]), 1, N_RATES)
            rates_cum[N_RATES + 1] = rates_cum[N_RATES] + rate_cr
            rates_cum[N_RATES + 2] = rates_cum[N_RATES + 1] + rate_CT_emit
            k_tot = rates_cum[end]
            if k_tot <= 0
                return Traj(timeout, t, n_cr, n_cs, n_hops, r2_max, t_first_cs, c)
            end

            t += -log(rand(rng)) / k_tot
            if t > t_max
                return Traj(timeout, t_max, n_cr, n_cs, n_hops, r2_max, t_first_cs, c)
            end

            j = sample_cum(rates_cum, rng)
            if j == N_RATES + 1
                state = LE
                n_cr += 1
            elseif j == N_RATES + 2
                return Traj(CT_emission, t, n_cr, n_cs, n_hops, r2_max, t_first_cs, c)
            else
                h_idx = sys.rate_table_indexes[c, h_idx, j]
                n_hops += 1
                r_ct = sys.r_host_ct[c, h_idx]
                r2 = round(Int, r_ct * r_ct)
                r2 > r2_max && (r2_max = r2)
            end
        end
    end
    return Traj(steplimit, t, n_cr, n_cs, n_hops, r2_max, t_first_cs, c)
end

# ---------------------------------------------------------------------------
# Ensemble + decay histograms
# ---------------------------------------------------------------------------

struct Ensemble
    trajs::Vector{Traj}
    t_cent::Vector{Float64}
    I_LE::Vector{Float64}
    I_CT::Vector{Float64}
    I_total::Vector{Float64}
    n_LE::Int
    n_CT::Int
    n_timeout::Int
    n_steplimit::Int
    phi_LE::Float64
    phi_CT::Float64
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

function run_ensemble(sys::System; n_traj::Int = N_TRAJ, seed::Int = SEED)
    trajs = Vector{Traj}(undef, n_traj)
    @threads for i in 1:n_traj
        trajs[i] = simulate_one(sys, Xoshiro(seed + 1_000_003 * i))
    end

    t_LE = Float64[]
    t_CT = Float64[]
    sizehint!(t_LE, n_traj ÷ 10)
    sizehint!(t_CT, n_traj)
    n_LE = 0
    n_CT = 0
    n_timeout = 0
    n_steplimit = 0
    n_cs_sum = 0
    n_cr_sum = 0
    n_hops_sum = 0

    for tr in trajs
        n_cs_sum += tr.n_cs
        n_cr_sum += tr.n_cr
        n_hops_sum += tr.n_hops
        if tr.outcome === LE_emission
            n_LE += 1
            push!(t_LE, tr.t)
        elseif tr.outcome === CT_emission
            n_CT += 1
            push!(t_CT, tr.t)
        elseif tr.outcome === timeout
            n_timeout += 1
        else
            n_steplimit += 1
        end
    end

    edges, cent = log_bins(T_MIN_HIST, T_MAX, N_BINS)
    dt = diff(edges)
    c_LE = zeros(Int, N_BINS)
    c_CT = zeros(Int, N_BINS)
    histogram_times!(c_LE, edges, t_LE)
    histogram_times!(c_CT, edges, t_CT)
    norm = Float64(n_traj)
    I_LE = c_LE ./ (norm .* dt)
    I_CT = c_CT ./ (norm .* dt)
    I_total = I_LE .+ I_CT

    return Ensemble(trajs, cent, I_LE, I_CT, I_total,
                    n_LE, n_CT, n_timeout, n_steplimit,
                    n_LE / n_traj, n_CT / n_traj,
                    n_cs_sum / n_traj, n_cr_sum / n_traj, n_hops_sum / n_traj)
end

function write_decay_csv(path, e::Ensemble)
    open(path, "w") do io
        println(io, "t_s,I_LE,I_CT,I_total")
        for i in eachindex(e.t_cent)
            @printf(io, "%.8e,%.8e,%.8e,%.8e\n",
                    e.t_cent[i], e.I_LE[i], e.I_CT[i], e.I_total[i])
        end
    end
end

function write_summary_csv(path, e::Ensemble)
    open(path, "w") do io
        println(io, "N_traj,N_host,L_nm,lambda_eV,beta_nm,tau_LE_s,tau0_CT_s,T_K,C_eVnm,HOMO_c,LUMO_c,LUMO_h,phi_LE,phi_CT,n_LE,n_CT,n_timeout,n_steplimit,mean_n_cs,mean_n_cr,mean_n_hops")
        @printf(io,
            "%d,%d,%.6f,%.4f,%.4f,%.6e,%.6e,%.1f,%.6f,%.3f,%.3f,%.3f,%.6e,%.6e,%d,%d,%d,%d,%.6e,%.6e,%.6e\n",
            length(e.trajs), N_PARTICLES, L, LAMBDA_EV, BETA_INV_NM,
            TAU_LE, TAU0_CT, T_K, COULOUMB_CONST,
            HOMO_CENTER, LUMO_CENTER, LUMO_HOST,
            e.phi_LE, e.phi_CT, e.n_LE, e.n_CT, e.n_timeout, e.n_steplimit,
            e.mean_n_cs, e.mean_n_cr, e.mean_n_hops)
    end
end

const PLOT_PY = raw"""
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
"""

function plot_with_python(outdir::String)
    pyfile = joinpath(outdir, "_plot_emission.py")
    write(pyfile, PLOT_PY)
    env = copy(ENV)
    env["MPLCONFIGDIR"] = joinpath(outdir, ".mplconfig")
    mkpath(env["MPLCONFIGDIR"])
    run(setenv(`python3 $pyfile $outdir`, env))
end

function main()
    mkpath(OUTDIR)
    println("============================================================")
    println("  kMC LE / CT hopping in a periodic disordered box")
    println("============================================================")
    @printf("  N_host = %d    L = %.2f nm    β = %.2f nm⁻¹    λ = %.2f eV\n",
            N_PARTICLES, L, BETA_INV_NM, LAMBDA_EV)
    @printf("  τ_LE = %.2e s    τ0_CT = %.2e s    T = %.0f K\n", TAU_LE, TAU0_CT, T_K)
    @printf("  Coulomb C = %.3f eV·nm    N_traj = %d    threads = %d\n",
            COULOUMB_CONST, N_TRAJ, nthreads())
    println()

    print("  building shared box + rate tables … ")
    flush(stdout)
    t_build = time()
    sys = build_system(Xoshiro(SEED))
    @printf("done in %.2f s  (%d centres, top-%d hops)\n",
            time() - t_build, sys.n_centers, N_RATES)

    print("  running ensemble … ")
    flush(stdout)
    t0 = time()
    e = run_ensemble(sys)
    @printf("done in %.1f s\n", time() - t0)
    @printf("  LE_emission=%d (φ=%.4f)   CT_emission=%d (φ=%.4f)\n",
            e.n_LE, e.phi_LE, e.n_CT, e.phi_CT)
    @printf("  timeout=%d  steplimit=%d   ⟨n_CS⟩=%.3f  ⟨n_CR⟩=%.3f  ⟨n_hops⟩=%.1f\n",
            e.n_timeout, e.n_steplimit, e.mean_n_cs, e.mean_n_cr, e.mean_n_hops)

    decay_csv = joinpath(OUTDIR, "decay_curves.csv")
    sum_csv = joinpath(OUTDIR, "summary.csv")
    write_decay_csv(decay_csv, e)
    write_summary_csv(sum_csv, e)
    println("  wrote ", decay_csv)
    println("  wrote ", sum_csv)

    println("  plotting …")
    plot_with_python(OUTDIR)
    println("  figures: emission_decay.{png,pdf}  emission_yields.{png,pdf}")
    println("============================================================")
    return e
end

if abspath(PROGRAM_FILE) == @__FILE__
    # Thread count cannot be raised after Julia has started. Default is 1.
    if nthreads() == 1 && get(ENV, "KMC_NO_REEXEC", "") != "1"
        println("note: Julia started with 1 thread; re-launching with -t auto …")
        flush(stdout)
        p = run(ignorestatus(`$(Base.julia_cmd()) -t auto $(PROGRAM_FILE) $ARGS`))
        exit(p.exitcode)
    end
    main()
end
