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

const N_TRAJ      = 400_000   # 2_000_000
const LAMBDA_EV   = 0.4
const N_PARTICLES = 5_000
const L           = (N_PARTICLES / DENSITY)^(1/3) # in nm
const EPS_HOST    = 3.2
const C_CENTERS   = 0.01   # 1% conc.
const T_K         = 300.0
const NU0         = 1.0e13          # s⁻¹, Miller–Abrahams prefactor (as in LPLModel)
const BETA_INV_NM = 1               # nm⁻¹, inverse localisation length for hopping 
const BETA_INV_TAU_CT_NM = 1.0      # nm⁻¹, inverse localisation length for CT emission rate
const A_NM        = 1.0             # nm, lattice constant
const TAU_LE      = 1.0e-8          # s, LE lifetime  (k_LE = 1e8 s⁻¹, LPLModel default)
const TAU0_CT     = 1.0e-6         # s, CT* lifetime for zero separation distance
const T_MAX       = 1.0e-2          # s
const MAX_EVENTS  = 800_000
const SEED        = 1
const T_MIN_HIST  = 1.0e-12         # s
const N_BINS      = 90
const N_HOP_BINS  = 80              # host–host hop-distance histogram bins

const COULOUMB_CONST = E_CHARGE * 1e9 / (4 * π * EPS_0 * EPS_HOST)  # in eV.nm

# ('$\\alpha$NPD', -5.2, -2.1, red),
# ('BP2DPA',	-5.65, -2.74, red),
# ('4CzIPN',	-5.8	, -3.4, red),
# ('HAP-3TPA',	-5.56, -3.31, red),
# ('PET', -7.11, -3.06, blue), # band gap 306 nm

const HOMO_CENTER = -5.65
const LUMO_CENTER = -2.74
 
const HOMO_HOST = -7.11
const LUMO_HOST = -4.5

const OUTDIR = joinpath(@__DIR__, "kmc_sigma=0.00")
const R_MIN_NM = 0.2   # nm; floor for Coulomb / tunneling distances
const N_RATES  = 25    # top hop channels kept per (centre, host) pair
const LUMO_STD_HOST = 0.00
const LUMO_STD_CENTER = 0.0
const HOMO_STD_CENTER = 0.0
const MAX_PATH_STEPS = 25_000   # cap recorded steps for sample 3D paths
const N_SAMPLE_PATHS = 5        # example trajectories saved for 3D plot

"""Marcus activation energy (eV)."""
marcus_Ea(λ::Float64, ΔG::Float64) = (λ + ΔG)^2 / (4λ)

"""Miller–Abrahams rate (s⁻¹) with a Marcus barrier at distance r (nm)."""
function miller_abrahams(ν0, β, r_nm, Ea, T)
    return ν0 * exp(-β * r_nm - Ea / (KB_EV * T))
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

"""
State energies are excess energies above the neutral ground state S0 ≡ 0.

Orbital energies (HOMO, LUMO) are vacuum eigenvalues (typically negative).
For centre c and host i at separation r:

  E_LE(c)    = LUMO_c − HOMO_c
  E_CT(c, i) = LUMO_i − HOMO_c − C/r

Hopping i→j with the hole fixed on c then has
  ΔG = E_CT(c,j) − E_CT(c,i)
which equals (LUMO_j − C/r_j) − (LUMO_i − C/r_i); HOMO_c cancels.
"""
E_LE(E_LUMO_c::Float64, E_HOMO_c::Float64) = E_LUMO_c - E_HOMO_c

function E_CT(E_HOMO_c::Float64, E_LUMO_h::Float64, r_nm::Float64)
    r = max(r_nm, R_MIN_NM)
    return E_LUMO_h - E_HOMO_c - COULOUMB_CONST / r
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
    r2_max::Float64
    r2_outcome::Float64
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
    E_le::Vector{Float64}              # (Nc,)  E_LE above S0=0
    E_ct::Matrix{Float64}              # (Nc, N) E_CT(c,i) above S0=0
    r_host_ct::Matrix{Float64}         # (Nc, N)  centre–host distance
    rates_ct::Matrix{Float64}          # (Nc, N)  LE → CT onto host
    rates_ct_cum::Matrix{Float64}      # (Nc, N)
    rates_cr::Matrix{Float64}          # (Nc, N)  CT → LE from host
    rates_ct_emit::Matrix{Float64}     # (Nc, N)  CT emission from host
    rate_table::Array{Float64,3}       # (Nc, N, N_RATES)
    rate_table_cumsums::Array{Float64,3}
    rate_table_indexes::Array{Int,3}
    rate_table_r::Array{Float64,3}     # (Nc, N, N_RATES) host–host hop distance (nm)
    k_LE::Float64
end

"""Sample index i with probability ∝ weights, given cumulative sums `cum`."""
function sample_cum(cum::AbstractVector{Float64}, rng)
    u = rand(rng) * cum[end]
    return searchsortedfirst(cum, u)
end

"""Write host / centre coordinates and site energies for 3D visualisation."""
function write_morphology(sys::System, outdir::String = OUTDIR)
    mkpath(outdir)
    open(joinpath(outdir, "morphology_hosts.csv"), "w") do io
        println(io, "host_idx,x_nm,y_nm,z_nm,LUMO_eV")
        @inbounds for i in 1:sys.n_host
            @printf(io, "%d,%.8e,%.8e,%.8e,%.8e\n",
                    i, sys.xyz_host[i, 1], sys.xyz_host[i, 2], sys.xyz_host[i, 3],
                    sys.host_LUMO[i])
        end
    end
    open(joinpath(outdir, "morphology_centers.csv"), "w") do io
        println(io, "center_idx,x_nm,y_nm,z_nm,HOMO_eV,LUMO_eV,E_LE_eV")
        @inbounds for c in 1:sys.n_centers
            @printf(io, "%d,%.8e,%.8e,%.8e,%.8e,%.8e,%.8e\n",
                    c, sys.xyz_centers[c, 1], sys.xyz_centers[c, 2], sys.xyz_centers[c, 3],
                    sys.center_HOMO[c], sys.center_LUMO[c], sys.E_le[c])
        end
    end
    open(joinpath(outdir, "morphology_meta.csv"), "w") do io
        println(io, "L_nm,n_host,n_centers")
        @printf(io, "%.8e,%d,%d\n", sys.Lbox, sys.n_host, sys.n_centers)
    end
    return nothing
end

"""Build one periodic box and precompute rates for every centre."""
function build_system(rng::AbstractRNG;
                      n_host::Int = N_PARTICLES,
                      Lbox::Float64 = Float64(L),
                      write_morph::Bool = true)
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
    E_ct = Matrix{Float64}(undef, n_centers, n_host)
    rates_ct = Matrix{Float64}(undef, n_centers, n_host)
    rates_ct_cum = Matrix{Float64}(undef, n_centers, n_host)
    rates_cr = Matrix{Float64}(undef, n_centers, n_host)
    rates_ct_emit = Matrix{Float64}(undef, n_centers, n_host)
    rate_table = Array{Float64,3}(undef, n_centers, n_host, N_RATES)
    rate_table_cumsums = Array{Float64,3}(undef, n_centers, n_host, N_RATES)
    rate_table_indexes = Array{Int,3}(undef, n_centers, n_host, N_RATES)
    rate_table_r = Array{Float64,3}(undef, n_centers, n_host, N_RATES)

    # fill per-centre tables (threaded over centres)
    @threads for c in 1:n_centers
        rates_hop_full = Vector{Float64}(undef, n_host)
        xc = @view xyz_centers[c, :]
        Ele = E_le[c]
        EHc = center_HOMO[c]

        # state energies on S0=0 scale, then CS / CR / CT-emission rates
        @inbounds for i in 1:n_host
            r_nm = max(dist_pbc(xc, @view(xyz_host[i, :]), Lbox), R_MIN_NM)
            r_host_ct[c, i] = r_nm
            Ect = E_CT(EHc, host_LUMO[i], r_nm)
            E_ct[c, i] = Ect
            dG_cs = Ect - Ele                 # LE → CT
            rates_ct[c, i] = miller_abrahams(NU0, BETA_INV_NM, r_nm,
                                             marcus_Ea(LAMBDA_EV, dG_cs), T_K)
            rates_cr[c, i] = miller_abrahams(NU0, BETA_INV_NM, r_nm,
                                             marcus_Ea(LAMBDA_EV, -dG_cs), T_K)
            rates_ct_emit[c, i] = k_CT0 * exp(-BETA_INV_TAU_CT_NM * r_nm)
            rates_ct_cum[c, i] = (i == 1 ? 0.0 : rates_ct_cum[c, i - 1]) + rates_ct[c, i]
        end

        # hops from CT(i) → CT(j): ΔG = E_CT(c,j) − E_CT(c,i)
        @inbounds for i in 1:n_host
            E_i = E_ct[c, i]
            for j in 1:n_host
                if i == j
                    rates_hop_full[j] = 0.0
                else
                    dG = E_ct[c, j] - E_i
                    rates_hop_full[j] = miller_abrahams(NU0, BETA_INV_NM, r_hh[i, j],
                                                        marcus_Ea(LAMBDA_EV, dG), T_K)
                end
            end
            top = partialsortperm(rates_hop_full, 1:N_RATES; rev=true)
            for k in 1:N_RATES
                dest = top[k]
                rate_table_indexes[c, i, k] = dest
                rate_table[c, i, k] = rates_hop_full[dest]
                rate_table_r[c, i, k] = r_hh[i, dest]
                rate_table_cumsums[c, i, k] =
                    (k == 1 ? 0.0 : rate_table_cumsums[c, i, k - 1]) + rate_table[c, i, k]
            end
        end
    end

    sys = System(Lbox, n_host, n_centers, xyz_host, xyz_centers,
                 host_LUMO, center_LUMO, center_HOMO, E_le, E_ct, r_host_ct,
                 rates_ct, rates_ct_cum, rates_cr, rates_ct_emit,
                 rate_table, rate_table_cumsums, rate_table_indexes, rate_table_r, k_LE)
    write_morph && write_morphology(sys)
    return sys
end

mutable struct PathRec
    t::Vector{Float64}
    state::Vector{String}
    site_idx::Vector{Int}
    x::Vector{Float64}
    y::Vector{Float64}
    z::Vector{Float64}
end
PathRec() = PathRec(Float64[], String[], Int[], Float64[], Float64[], Float64[])

function record_path!(path::Nothing, sys::System, c::Int, state::State, h_idx::Int, t::Float64)
    return nothing
end

function record_path!(path::PathRec, sys::System, c::Int, state::State, h_idx::Int, t::Float64)
    length(path.t) >= MAX_PATH_STEPS && return nothing
    if state === LE
        push!(path.t, t)
        push!(path.state, "LE")
        push!(path.site_idx, 0)
        push!(path.x, sys.xyz_centers[c, 1])
        push!(path.y, sys.xyz_centers[c, 2])
        push!(path.z, sys.xyz_centers[c, 3])
    else
        push!(path.t, t)
        push!(path.state, "hopping")
        push!(path.site_idx, h_idx)
        push!(path.x, sys.xyz_host[h_idx, 1])
        push!(path.y, sys.xyz_host[h_idx, 2])
        push!(path.z, sys.xyz_host[h_idx, 3])
    end
    return nothing
end

"""
One trajectory on a shared `System`: pick a random centre, start as LE, Gillespie.

Optional `c_fixed` overrides the centre after consuming the same RNG draw (so a
recorded ensemble seed can be replayed). Optional `path` records site visits.
"""
function simulate_one(sys::System, rng::AbstractRNG,
                      hop_accum::Union{Nothing,Tuple{Vector{Float64},Vector{Int},Vector{Float64}}} = nothing;
                      t_max::Float64 = T_MAX,
                      max_events::Int = MAX_EVENTS,
                      c_fixed::Union{Nothing,Int} = nothing,
                      path::Union{Nothing,PathRec} = nothing)
    c_draw = rand(rng, 1:sys.n_centers)
    c = c_fixed === nothing ? c_draw : Int(c_fixed)
    k_LE = sys.k_LE
    rates_cum = Vector{Float64}(undef, N_RATES + 2)

    state = LE
    h_idx = 1
    t = 0.0
    n_cs = 0
    n_cr = 0
    n_hops = 0
    r2_max = 0.0
    r2 = 0.0
    t_first_cs = NaN
    record_path!(path, sys, c, state, h_idx, t)

    @inbounds for _ in 1:max_events
        if state === LE
            r2 = 0.0
            k_tot = k_LE + sys.rates_ct_cum[c, end]
            t += -log(rand(rng)) / k_tot
            if t > t_max
                record_path!(path, sys, c, state, h_idx, t_max)
                return Traj(timeout, t_max, n_cr, n_cs, n_hops, r2_max, r2, t_first_cs, c)
            end
            if rand(rng) * k_tot < k_LE
                record_path!(path, sys, c, state, h_idx, t)
                return Traj(LE_emission, t, n_cr, n_cs, n_hops, r2_max, r2, t_first_cs, c)
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
            r2 = r_ct0 * r_ct0
            r2 > r2_max && (r2_max = r2)
            record_path!(path, sys, c, state, h_idx, t)
        else
            rate_cr = sys.rates_cr[c, h_idx]
            rate_CT_emit = sys.rates_ct_emit[c, h_idx]

            copyto!(rates_cum, 1, @view(sys.rate_table_cumsums[c, h_idx, :]), 1, N_RATES)
            rates_cum[N_RATES + 1] = rates_cum[N_RATES] + rate_cr
            rates_cum[N_RATES + 2] = rates_cum[N_RATES + 1] + rate_CT_emit
            k_tot = rates_cum[end]
            if k_tot <= 0
                record_path!(path, sys, c, state, h_idx, t)
                return Traj(timeout, t, n_cr, n_cs, n_hops, r2_max, r2, t_first_cs, c)
            end

            t += -log(rand(rng)) / k_tot
            if t > t_max
                record_path!(path, sys, c, state, h_idx, t_max)
                return Traj(timeout, t_max, n_cr, n_cs, n_hops, r2_max, r2, t_first_cs, c)
            end

            j = sample_cum(rates_cum, rng)
            if j == N_RATES + 1
                state = LE
                n_cr += 1
                record_path!(path, sys, c, state, h_idx, t)
            elseif j == N_RATES + 2
                record_path!(path, sys, c, state, h_idx, t)
                return Traj(CT_emission, t, n_cr, n_cs, n_hops, r2_max, r2, t_first_cs, c)
            else
                if hop_accum !== nothing
                    edges, counts, stats = hop_accum
                    r_hop = sys.rate_table_r[c, h_idx, j]
                    stats[1] += r_hop
                    stats[2] += 1.0
                    b = searchsortedlast(edges, r_hop)
                    if 1 <= b < length(edges)
                        counts[b] += 1
                    elseif r_hop >= edges[end]
                        counts[end] += 1
                    end
                end
                h_idx = sys.rate_table_indexes[c, h_idx, j]
                n_hops += 1
                r_ct = sys.r_host_ct[c, h_idx]
                r2 = r_ct * r_ct
                r2 > r2_max && (r2_max = r2)
                record_path!(path, sys, c, state, h_idx, t)
            end
        end
    end
    record_path!(path, sys, c, state, h_idx, t)
    return Traj(steplimit, t, n_cr, n_cs, n_hops, r2_max, r2, t_first_cs, c)
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
    r_CT_emit::Vector{Float64}   # centre–host distance at CT emission (nm)
    hop_edges::Vector{Float64}   # bin edges for host–host hop histogram (nm)
    hop_counts::Vector{Int}      # counts per bin
    mean_r_hop::Float64
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
    r_hop_max = sys.Lbox * sqrt(3) / 2
    hop_edges = collect(range(R_MIN_NM, r_hop_max; length = N_HOP_BINS + 1))
    n_tls = Threads.maxthreadid()
    hop_counts_tls = [zeros(Int, N_HOP_BINS) for _ in 1:n_tls]
    hop_stats_tls = [zeros(Float64, 2) for _ in 1:n_tls]  # sum_r, n
    @threads for i in 1:n_traj
        tid = threadid()
        trajs[i] = simulate_one(sys, Xoshiro(seed + 1_000_003 * i),
                                (hop_edges, hop_counts_tls[tid], hop_stats_tls[tid]))
    end
    hop_counts = zeros(Int, N_HOP_BINS)
    sum_r = 0.0
    n_hop = 0.0
    for tid in 1:n_tls
        hop_counts .+= hop_counts_tls[tid]
        sum_r += hop_stats_tls[tid][1]
        n_hop += hop_stats_tls[tid][2]
    end
    mean_r_hop = n_hop > 0 ? sum_r / n_hop : NaN

    t_LE = Float64[]
    t_CT = Float64[]
    r_CT_emit = Float64[]
    sizehint!(t_LE, n_traj ÷ 10)
    sizehint!(t_CT, n_traj)
    sizehint!(r_CT_emit, n_traj)
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
            push!(r_CT_emit, sqrt(tr.r2_outcome))
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

    return Ensemble(trajs, cent, I_LE, I_CT, I_total, r_CT_emit,
                    hop_edges, hop_counts, mean_r_hop,
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

"""Max centre–carrier distance per trajectory, excluding LE emission (r_max = 0)."""
function write_rmax_csv(path, e::Ensemble)
    open(path, "w") do io
        println(io, "outcome,r_max_nm,r2_max")
        for tr in e.trajs
            tr.outcome === LE_emission && continue
            @printf(io, "%s,%.8e,%.8e\n",
                    String(Symbol(tr.outcome)), sqrt(tr.r2_max), tr.r2_max)
        end
    end
end

"""Centre–host distance at the moment of CT emission."""
function write_ct_r_csv(path, e::Ensemble)
    open(path, "w") do io
        println(io, "r_nm,r2")
        for r in e.r_CT_emit
            @printf(io, "%.8e,%.8e\n", r, r * r)
        end
    end
end

"""Host–host hop-distance histogram (online-binned; all hops counted)."""
function write_hop_r_csv(path, e::Ensemble)
    open(path, "w") do io
        println(io, "r_lo_nm,r_hi_nm,r_cent_nm,count")
        for i in eachindex(e.hop_counts)
            lo = e.hop_edges[i]
            hi = e.hop_edges[i + 1]
            @printf(io, "%.8e,%.8e,%.8e,%d\n",
                    lo, hi, 0.5 * (lo + hi), e.hop_counts[i])
        end
    end
end

"""Pick one centre with the most distinct outcomes, then up to `n_sample` traj indices."""
function select_sample_traj_indices(trajs::Vector{Traj}; n_sample::Int = N_SAMPLE_PATHS,
                                    rng::AbstractRNG = Xoshiro(SEED + 7))
    by_c = Dict{Int, Dict{Outcome, Vector{Int}}}()
    for (i, tr) in enumerate(trajs)
        d = get!(by_c, tr.c_idx) do
            Dict{Outcome, Vector{Int}}()
        end
        push!(get!(d, tr.outcome, Int[]), i)
    end
    isempty(by_c) && return (0, Int[])

    c_best = first(keys(by_c))
    n_best = -1
    for (c, d) in by_c
        n_out = length(d)
        if n_out > n_best || (n_out == n_best && c < c_best)
            c_best = c
            n_best = n_out
        end
    end
    d = by_c[c_best]
    outcomes_order = [LE_emission, CT_emission, timeout, steplimit]
    chosen = Int[]
    used_outcomes = Outcome[]
    for oc in outcomes_order
        haskey(d, oc) || continue
        idxs = d[oc]
        # prefer shorter paths for visualisation
        i_pick = argmin(j -> trajs[j].n_hops, idxs)
        push!(chosen, i_pick)
        push!(used_outcomes, oc)
        length(chosen) >= n_sample && break
    end
    # fill to n_sample with other trajs from same centre (diverse leftovers)
    if length(chosen) < n_sample
        pool = Int[]
        for (_, idxs) in d
            append!(pool, idxs)
        end
        filter!(i -> !(i in chosen), pool)
        shuffle!(rng, pool)
        sort!(pool; by = i -> -trajs[i].n_hops)  # prefer richer hop paths next
        for i in pool
            push!(chosen, i)
            length(chosen) >= n_sample && break
        end
    end
    return (c_best, chosen)
end

"""Replay selected ensemble seeds with path recording and write CSVs for 3D plotting."""
function save_sample_trajectories(sys::System, trajs::Vector{Traj}, outdir::String = OUTDIR;
                                  n_sample::Int = N_SAMPLE_PATHS, seed::Int = SEED)
    c_idx, indices = select_sample_traj_indices(trajs; n_sample = n_sample)
    if isempty(indices)
        @warn "no sample trajectories to save"
        return 0
    end
    mkpath(outdir)
    meta_path = joinpath(outdir, "sample_traj_meta.csv")
    path_csv = joinpath(outdir, "sample_traj_paths.csv")
    open(meta_path, "w") do meta
        open(path_csv, "w") do io
            println(meta, "traj_id,ensemble_index,outcome,c_idx,t_s,n_hops,n_cs,n_cr,r_max_nm,n_path_steps")
            println(io, "traj_id,outcome,c_idx,step,t_s,state,site_idx,x_nm,y_nm,z_nm")
            for (tid, i) in enumerate(indices)
                tr0 = trajs[i]
                path = PathRec()
                tr = simulate_one(sys, Xoshiro(seed + 1_000_003 * i), nothing;
                                  c_fixed = tr0.c_idx, path = path)
                @printf(meta, "%d,%d,%s,%d,%.8e,%d,%d,%d,%.8e,%d\n",
                        tid, i, String(Symbol(tr.outcome)), tr.c_idx, tr.t,
                        tr.n_hops, tr.n_cs, tr.n_cr, sqrt(tr.r2_max), length(path.t))
                for s in eachindex(path.t)
                    @printf(io, "%d,%s,%d,%d,%.8e,%s,%d,%.8e,%.8e,%.8e\n",
                            tid, String(Symbol(tr.outcome)), tr.c_idx, s, path.t[s],
                            path.state[s], path.site_idx[s],
                            path.x[s], path.y[s], path.z[s])
                end
            end
        end
    end
    println("  sample paths: centre=$c_idx  n=$(length(indices))  → ", path_csv)
    return length(indices)
end


function plot_with_python(outdir::String, run_names::AbstractVector{<:AbstractString})
    # First CLI arg = parent output dir; remaining args = subdirectory names under it.
    pyfile = joinpath(@__DIR__, "plot_emission.py")
    run(`python3 $pyfile $outdir $(run_names...)`)
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
    @printf("  hop histogram: %d hops, ⟨r_hop⟩=%.3f nm\n",
            sum(e.hop_counts), e.mean_r_hop)

    decay_csv = joinpath(OUTDIR, "decay_curves.csv")
    sum_csv = joinpath(OUTDIR, "summary.csv")
    rmax_csv = joinpath(OUTDIR, "rmax.csv")
    ct_r_csv = joinpath(OUTDIR, "ct_emission_r.csv")
    hop_r_csv = joinpath(OUTDIR, "hop_r.csv")
    write_decay_csv(decay_csv, e)
    write_summary_csv(sum_csv, e)
    write_rmax_csv(rmax_csv, e)
    write_ct_r_csv(ct_r_csv, e)
    write_hop_r_csv(hop_r_csv, e)
    println("  wrote ", decay_csv)
    println("  wrote ", sum_csv)
    println("  wrote ", rmax_csv)
    println("  wrote ", ct_r_csv)
    println("  wrote ", hop_r_csv)
    println("  wrote morphology_hosts.csv / morphology_centers.csv")
    save_sample_trajectories(sys, e.trajs)

    println("  plotting …")
    # plot_with_python(OUTDIR)
    println("  figures: emission_decay.png  rmax_hist.png  ct_emission_r_hist.png  hop_r_hist.png  trajectories_3d.png")
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
