import sys

"""Reference implementation. Two independent models must agree on every case:
   (1) the angel-side formula from the plan, (2) a full share-count cap table."""

TOL = 1e-9
fails, checks = [], 0

def eq(label, got, want, tol=1e-7):
    global checks
    checks += 1
    ok = abs(got - want) <= tol * max(1.0, abs(want))
    if not ok: fails.append(f"{label}: got {got!r}, want {want!r}")
    return ok

# ---------- model 1: the angel-side formula ----------
def own_after(own_before, pre, raised, invested=0.0, pool=0.0):
    V = pre + raised
    assert pool < pre / V, "pool exceeds the pre-money fraction"
    return own_before * (pre / V - pool) + invested / V

def pro_rata(own_before, raised, pre, pool=0.0):
    V = pre + raised
    return own_before * (raised + pool * V)

# ---------- model 2: an independent share ledger ----------
class Ledger:
    def __init__(self, founder_shares=8_000_000):
        self.total = float(founder_shares)
        self.angel = 0.0
        self.unallocated_pool = 0.0
    def priced_round(self, pre, raised, angel_invests=0.0, pool=0.0):
        V = pre + raised
        D = (self.total - self.unallocated_pool) / (1 - pool * V / pre)
        p = pre / D
        new_pool = D - self.total
        self.total = D * V / pre
        self.unallocated_pool = pool * self.total
        self.angel += angel_invests / p
        return p, new_pool
    def own(self): return self.angel / self.total

print("=" * 72)
print("GOLDEN CASES")
print("=" * 72)

# A: entry
a = own_after(0.0, 8e6, 2e6, invested=50_000)
eq("A ownership", a, 0.005)
L = Ledger(); L.priced_round(8e6, 2e6, angel_invests=50_000)
eq("A ledger agrees", L.own(), a)
print(f"A  entry ....................... {a:.4%}                 [ledger {L.own():.4%}]")

# B: sit out Series B
b = own_after(a, 24e6, 6e6)
eq("B ownership", b, 0.004)
eq("B value", b * 30e6, 120_000)
L2 = Ledger(); L2.priced_round(8e6, 2e6, angel_invests=50_000); L2.priced_round(24e6, 6e6)
eq("B ledger agrees", L2.own(), b)
print(f"B  sit out Series B ............ {b:.4%}  ${b*30e6:>10,.0f}  [ledger {L2.own():.4%}]")

# C: pro-rata
c_cheque = pro_rata(a, 6e6, 24e6)
c = own_after(a, 24e6, 6e6, invested=c_cheque)
eq("C cheque", c_cheque, 30_000)
eq("C holds", c, 0.005); eq("C value", c * 30e6, 150_000)
L3 = Ledger(); L3.priced_round(8e6, 2e6, angel_invests=50_000); L3.priced_round(24e6, 6e6, angel_invests=c_cheque)
eq("C ledger agrees", L3.own(), c)
print(f"C  pro-rata ${c_cheque:>9,.0f} ......... {c:.4%}  ${c*30e6:>10,.0f}  [ledger {L3.own():.4%}]")

# D: with a 10% new pool
d = own_after(a, 24e6, 6e6, pool=0.10)
d_cheque = pro_rata(a, 6e6, 24e6, pool=0.10)
eq("D ownership", d, 0.0035); eq("D cheque", d_cheque, 45_000)
L4 = Ledger(); L4.priced_round(8e6, 2e6, angel_invests=50_000); L4.priced_round(24e6, 6e6, pool=0.10)
eq("D ledger agrees", L4.own(), d)
L5 = Ledger(); L5.priced_round(8e6, 2e6, angel_invests=50_000); L5.priced_round(24e6, 6e6, angel_invests=d_cheque, pool=0.10)
eq("D pro-rata holds 0.50%", L5.own(), 0.005)
print(f"D  10% pool, sit out ........... {d:.4%}   pro-rata now ${d_cheque:,.0f}  [ledger {L4.own():.4%}]")

# I: exit values
c_own = own_after(b, 48e6, 12e6)
eq("Series C sit-out ownership", c_own, 0.0032)
i_gross = c_own * 60e6
eq("I gross proceeds", i_gross, 192_000)
print(f"I  0.32% of $60M .............. ${i_gross:,.0f}")

# J: fees. Fees are paid on top of the cheque, so the whole cheque buys shares
# and carry is charged on the profit above the cheque, never on the fees.
def fees(gross, cheque, entry_pct, carry_pct):
    entry = cheque * entry_pct
    deployed = cheque
    outlay = cheque + entry
    carry = max(0.0, gross - deployed) * carry_pct
    net = gross - carry
    return dict(entry=entry, outlay=outlay, carry=carry, net=net,
                gross_x=gross / deployed, net_x=net / outlay, drag=carry + entry)
j = fees(500_000, 50_000, 0.02, 0.20)
eq("J outlay", j["outlay"], 51_000); eq("J carry", j["carry"], 90_000)
eq("J net", j["net"], 410_000);      eq("J net multiple", j["net_x"], 8.0392156862745, 1e-9)
eq("J drag", j["drag"], 91_000)
print(f"J  fees on $500k gross ........ outlay ${j['outlay']:,.0f}  carry ${j['carry']:,.0f}  "
      f"net ${j['net']:,.0f}  {j['gross_x']:.2f}x -> {j['net_x']:.2f}x  drag ${j['drag']:,.0f}")

# K: downside regime
def exit_proceeds(own, invested, exit_value, total_raised):
    if exit_value > total_raised: return own * exit_value, "clean"
    return min(invested, invested / total_raised * exit_value), "downside"
k, regime = exit_proceeds(c_own, 50_000, 15e6, 20e6)
eq("K proceeds", k, 37_500)
naive = c_own * 15e6
print(f"K  $15M exit, $20M raised ..... ${k:,.0f} [{regime}]   naive would say ${naive:,.0f}")

# L: the EUR 5,000 example the landing page and "Load example" use. Every
# number the page prints about it comes from the engine, and the engine is held
# to this: EUR 4M pre raising 1M, then Series A, B and C at EUR 15M, 40M and
# 100M post-money, each raising a fifth of its post-money, then an exit table.
def exit_band(own, invested, exit_value, total_raised, clean_multiple=2):
    pref = min(invested, invested / total_raised * exit_value) if total_raised > 0 else 0.0
    conv = own * exit_value
    if exit_value <= total_raised: return pref, pref, "downside"
    if exit_value > total_raised * clean_multiple: return conv, conv, "clean"
    return min(pref, conv), max(pref, conv), "uncertain"

l_rounds = [(12e6, 3e6), (32e6, 8e6), (80e6, 20e6)]
l_entry = own_after(0.0, 4e6, 1e6, invested=5_000)
eq("L entry ownership", l_entry, 0.001)
l_own, l_path = l_entry, [l_entry]
L9 = Ledger(); L9.priced_round(4e6, 1e6, angel_invests=5_000)
for pre, raised in l_rounds:
    l_own = own_after(l_own, pre, raised)
    l_path.append(l_own)
    L9.priced_round(pre, raised)
eq("L final ownership", l_own, 0.000512)
eq("L ledger agrees", L9.own(), l_own)
l_pro_rata_a = pro_rata(l_entry, 3e6, 12e6)
eq("L pro-rata at Series A", l_pro_rata_a, 3_000)
l_raised = 1e6 + sum(r for _, r in l_rounds)
l_ladder = []
for value in [10e6, 25e6, 50e6, 100e6, 250e6, 500e6, 1e9]:
    lo, hi, regime = exit_band(l_own, 5_000, value, l_raised)
    l_ladder.append(dict(value=value, low=lo, high=hi, regime=regime))
eq("L at EUR 250M", l_ladder[4]["high"], 128_000); eq("L MOIC at EUR 250M", l_ladder[4]["high"] / 5_000, 25.6)
eq("L at EUR 10M, downside", l_ladder[0]["low"], 1_562.5)
eq("L at EUR 50M, uncertain low", l_ladder[2]["low"], 5_000); eq("L at EUR 50M, uncertain high", l_ladder[2]["high"], 25_600)
print(f"L  EUR 5k example ............. {l_entry:.4%} -> {l_own:.4%}  [ledger {L9.own():.4%}]  "
      f"EUR {l_ladder[4]['high']:,.0f} at EUR 250M")
print("   exit table ................. " + "  ".join(
    f"{r['value']/1e6:g}M:{r['regime'][0]}" for r in l_ladder))

# M: the three paths through the EUR 5k example. Sitting out every round, and
# following on with exactly the pro-rata cheque each time, checked against the
# share ledger. The user's own path lies between them.
def paths(entry_pre, entry_raised, cheque, rounds, exit_value, total_raised, follow):
    own = own_after(0.0, entry_pre, entry_raised, invested=cheque)
    led = Ledger(); led.priced_round(entry_pre, entry_raised, angel_invests=cheque)
    cheques, series = [cheque], [(own, own * (entry_pre + entry_raised))]
    for pre, raised in rounds:
        c = pro_rata(own, raised, pre) if follow else 0.0
        own = own_after(own, pre, raised, invested=c)
        led.priced_round(pre, raised, angel_invests=c)
        cheques.append(c); series.append((own, own * (pre + raised)))
    eq("M ledger agrees", led.own(), own)
    lo, hi, regime = exit_band(own, sum(cheques), exit_value, total_raised)
    return dict(own=own, cheques=cheques, series=series, invested=sum(cheques), low=lo, high=hi, regime=regime)
m_sit = paths(4e6, 1e6, 5_000, l_rounds, 250e6, l_raised, follow=False)
m_pro = paths(4e6, 1e6, 5_000, l_rounds, 250e6, l_raised, follow=True)
eq("M sit-out final", m_sit["own"], 0.000512); eq("M sit-out gross", m_sit["high"], 128_000)
eq("M pro-rata final", m_pro["own"], 0.001); eq("M pro-rata invested", m_pro["invested"], 36_000)
eq("M pro-rata gross", m_pro["high"], 250_000)
m_carry = 0.20
m_net = lambda gross, invested: gross - max(0.0, gross - invested) * m_carry
eq("M pro-rata net", m_net(m_pro["high"], 36_000), 207_200)
eq("M pro-rata net multiple", m_net(m_pro["high"], 36_000) / 36_000, 207_200 / 36_000)
print(f"M  three paths at EUR 250M .... sit out {m_sit['own']:.4%} EUR {m_sit['high']:,.0f} on EUR 5,000   "
      f"pro-rata {m_pro['own']:.4%} EUR {m_pro['high']:,.0f} on EUR {m_pro['invested']:,.0f}")

# N: a round described as "valuation grows xg, company sells s%". The value of
# a stake that sits out changes by g * (1 - s - pool), which is the new price per
# share over the old one. Growing x1.25 while selling 25% loses value.
def stake_factor_ledger(prev_pre, prev_raised, g, s, pool=0.0):
    V0 = prev_pre + prev_raised
    V = g * V0; raised = s * V; pre = V - raised
    led = Ledger(); p0, _ = led.priced_round(prev_pre, prev_raised, angel_invests=10_000)
    before = led.angel * p0
    p1, _ = led.priced_round(pre, raised, pool=pool)
    return led.angel * p1 / before, V, raised
n_steps = []
for g, s, pool in [(3.0, 0.20, 0.0), (1.25, 0.25, 0.0), (2.0, 0.20, 0.10), (0.8, 0.30, 0.0)]:
    factor, V, raised = stake_factor_ledger(4e6, 1e6, g, s, pool)
    eq(f"N factor x{g} sells {s:.0%} pool {pool:.0%}", factor, g * (1 - s - pool))
    n_steps.append(dict(growth=g, sold=s, pool=pool, post=V, raised=raised, factor=factor))
assert n_steps[1]["factor"] < 1, "an up round that sells too much must lose value"
print("N  stake factor g(1-s-pool) ... " + "  ".join(
    f"x{r['growth']:g}/{r['sold']:.0%}/{r['pool']:.0%}->{r['factor']:.4f}" for r in n_steps))

# Q: four ways the EUR 5k example could end. The company fails, sells for
# exactly what it raised, or grows 10x or 100x from the post-money the angel
# invested at. The company's multiple is not the angel's: dilution, the
# preference stack and carry all sit in between. "covers" is how many other
# failed cheques one such win pays back, from the low end of any range.
import math
q_post = 5e6
q_values = [("fails", 0.0), ("capital", l_raised), ("grows10", 10 * q_post), ("grows100", 100 * q_post)]
q_runs = {}
for carry in (0.0, 0.20):
    rows = []
    for kind, value in q_values:
        lo, hi, regime = exit_band(l_own, 5_000, value, l_raised) if value > 0 else (0.0, 0.0, "downside")
        f_lo, f_hi = fees(lo, 5_000, 0.0, carry), fees(hi, 5_000, 0.0, carry)
        rows.append(dict(kind=kind, value=value, regime=regime, low=lo, high=hi,
                         net_low=f_lo["net"], net_high=f_hi["net"], x_low=f_lo["net_x"], x_high=f_hi["net_x"]))
    covers = {r["kind"]: max(0, math.floor(r["x_low"] + 1e-9) - 1) for r in rows if r["kind"].startswith("grows")}
    q_runs[carry] = dict(rows=rows, covers=covers)
q0, q20 = q_runs[0.0]["rows"], q_runs[0.20]["rows"]
eq("Q fails", q0[0]["high"], 0); eq("Q capital returns the cheque", q0[1]["low"], 5_000)
eq("Q 10x low", q0[2]["low"], 5_000); eq("Q 10x high", q0[2]["high"], 25_600)
eq("Q 100x gross", q0[3]["high"], 256_000); eq("Q 100x multiple", q0[3]["x_high"], 51.2)
eq("Q 100x net after 20% carry", q20[3]["net_high"], 205_800)
eq("Q covers at 100x, no carry", q_runs[0.0]["covers"]["grows100"], 50)
eq("Q covers at 100x, 20% carry", q_runs[0.20]["covers"]["grows100"], 40)
eq("Q covers at 10x", q_runs[0.20]["covers"]["grows10"], 0)
assert [r["regime"] for r in q0] == ["downside", "downside", "uncertain", "clean"]
print("Q  four endings ............... " + "  ".join(
    f"{r['kind']}:{r['low']:,.0f}-{r['high']:,.0f}" for r in q0) +
    f"   covers {q_runs[0.20]['covers']} at 20% carry")

# ---------- convertibles: SAFEs and convertible notes ----------
# A SAFE or note converts at the next priced round at the best of three prices:
# the cap, the round price less the discount, and the round price itself.
# The cap route fixes a share of the capitalisation before the round, so a new
# pool in that round dilutes it. The two price routes buy fully diluted shares
# at a price that already has the pool inside the pre-money, so it does not.
# That is why the engine picks the best final ownership rather than the lowest
# "effective valuation": the two agree only when there is no pool.
def accrue(principal, rate, years, mode="simple"):
    return principal * (1 + rate * years) if mode == "simple" else principal * (1 + rate) ** years

def convert_routes(conv, cap_post, discount, pre, raised, pool=0.0):
    V = pre + raised
    routes = []
    if cap_post:  routes.append(("cap", conv / cap_post * (pre / V - pool)))
    if discount:  routes.append(("discount", conv / ((1 - discount) * V)))
    routes.append(("round_price", conv / V))
    best = routes[0]
    for r in routes[1:]:
        if r[1] > best[1]: best = r          # ties stay with the earlier route
    return best

def ledger_convert(L, pre, raised, conv, cap_post=None, discount=0.0, pool=0.0, angel_invests=0.0):
    """Share ledger with the converting shares S solved as a fixed point: the
    round price counts S in the pre-money, and S depends on that price."""
    V = pre + raised
    T, u = L.total, L.unallocated_pool
    S = 0.0
    for _ in range(500):
        D = (T + S - u) / (1 - pool * V / pre)
        p = pre / D
        prices = [p, p * (1 - discount)]
        if cap_post: prices.append(cap_post / (T + S))   # post-money SAFE capitalisation, pool increase excluded
        S = conv / min(prices)
    D = (T + S - u) / (1 - pool * V / pre)
    p = pre / D
    L.total = D * V / pre
    L.unallocated_pool = pool * L.total
    L.angel += S + angel_invests / p
    return L.own()

def ledger_pre_cap(L, pre, raised, conv, cap, others):
    # Conversion price is the cap over the pre-conversion share count, so
    # everything converting alongside dilutes everything else.
    price = cap / L.total
    L.angel += conv / price
    L.total += (conv + others) / price
    L.priced_round(pre, raised)
    return L.own()

conv_cases = {}
def conv_case(name, amount, cap, pre, raised, discount=0.0, pool=0.0, follow=0.0,
              rate=0.0, years=0.0, mode="simple", basis="post", others=0.0):
    conv = accrue(amount, rate, years, mode)
    cap_post = cap if basis == "post" else cap + conv + others
    route, own = convert_routes(conv, cap_post, discount, pre, raised, pool)
    V = pre + raised
    final = own + follow / V
    if basis == "post":
        led = ledger_convert(Ledger(), pre, raised, conv, cap_post, discount, pool, follow)
    else:
        led = ledger_pre_cap(Ledger(), pre, raised, conv, cap, others)
    eq(f"{name} ledger agrees", led, final)
    conv_cases[name] = dict(amount=amount, cap=cap, basis=basis, others=others, discount=discount,
                            rate=rate, years=years, mode=mode, pre=pre, raised=raised, pool=pool,
                            follow=follow, converting=conv, route=route, ownership=final)
    print(f"{name:<3}{route:<12} converts {conv:>9,.0f} ........ {final:.4%}  [ledger {led:.4%}]")
    return final

eq("E post-money SAFE", conv_case("E", 100_000, 5e6, 8e6, 2e6), 0.016)
eq("E2 pre-money cap", conv_case("E2", 100_000, 5e6, 8e6, 2e6, basis="pre", others=400_000),
   100_000 / 5_500_000 * 0.8)
eq("F note, 8% simple, 2y", conv_case("F", 50_000, 5e6, 8e6, 2e6, discount=0.20, rate=0.08, years=2), 0.00928)
eq("F converting", conv_cases["F"]["converting"], 58_000)
eq("F2 note, compounding", conv_case("F2", 50_000, 5e6, 8e6, 2e6, rate=0.08, years=2, mode="compound"),
   58_320 / 5e6 * 0.8)
eq("G discount wins", conv_case("G", 100_000, 10e6, 6e6, 2e6, discount=0.20), 0.015625)
eq("H round price wins", conv_case("H", 100_000, 10e6, 6e6, 2e6), 0.0125)
eq("P cap, pool and follow-on", conv_case("P", 100_000, 5e6, 8e6, 2e6, discount=0.20, pool=0.10, follow=20_000),
   0.014 + 0.002)
eq("P2 discount under a pool", conv_case("P2", 100_000, 10e6, 6e6, 2e6, discount=0.20, pool=0.10), 0.015625)
assert conv_cases["G"]["route"] == "discount" and conv_cases["H"]["route"] == "round_price"
assert conv_cases["P"]["route"] == "cap" and conv_cases["P2"]["route"] == "discount"

print()
print("=" * 72)
print("CLAIMS MADE IN THE FOUR VISUALS")
print("=" * 72)

# viz 1: area == value
areas = [(0.005, 10e6), (0.004, 30e6), (0.0032, 60e6)]
vals = [o * v for o, v in areas]
eq("viz1 values", vals[0], 50_000); eq("viz1 values", vals[1], 120_000); eq("viz1 values", vals[2], 192_000)
eq("viz1 area ratio B", vals[1] / vals[0], 2.4); eq("viz1 area ratio C", vals[2] / vals[0], 3.84)
print(f"1  areas ...................... $50k / $120k / $192k   ratios 1 : {vals[1]/vals[0]:.2f} : {vals[2]/vals[0]:.2f}")

# viz 2: the bridge must close
def bridge(own_before, value_before, pre, raised, pool=0.0):
    V = pre + raised
    undiluted = own_before * V
    growth = undiluted - value_before
    after = own_after(own_before, pre, raised, pool=pool)
    dilution = after * V - undiluted
    return growth, dilution, after * V
gB, dB, endB = bridge(0.005, 50_000, 24e6, 6e6)
eq("bridge B growth", gB, 100_000); eq("bridge B dilution", dB, -30_000); eq("bridge B end", endB, 120_000)
eq("bridge B closes", 50_000 + gB + dB, endB)
gC, dC, endC = bridge(0.004, 120_000, 48e6, 12e6)
eq("bridge C growth", gC, 120_000); eq("bridge C dilution", dC, -48_000); eq("bridge C end", endC, 192_000)
eq("bridge C closes", 120_000 + gC + dC, endC)
print(f"2  Series B bridge ............ $50k {gB:+,.0f} {dB:+,.0f} = ${endB:,.0f}  closes")
print(f"   Series C bridge ............ $120k {gC:+,.0f} {dC:+,.0f} = ${endC:,.0f}  closes")

# viz 3: follow-on divergence
pB = pro_rata(0.005, 6e6, 24e6); oB = own_after(0.005, 24e6, 6e6, invested=pB)
pC = pro_rata(oB, 12e6, 48e6);   oC = own_after(oB, 48e6, 12e6, invested=pC)
deployed = 50_000 + pB + pC; stake = oC * 60e6
eq("viz3 B cheque", pB, 30_000); eq("viz3 C cheque", pC, 60_000)
eq("viz3 deployed", deployed, 140_000); eq("viz3 stake", stake, 300_000)
eq("viz3 follow multiple", stake / deployed, 300_000 / 140_000)
sit_stake = c_own * 60e6
print(f"3  follow on ................. deploy ${deployed:,.0f} -> ${stake:,.0f}  "
      f"gain ${stake-deployed:,.0f}  {stake/deployed:.2f}x")
print(f"   sit out ................... deploy ${50_000:,.0f} -> ${sit_stake:,.0f}  "
      f"gain ${sit_stake-50_000:,.0f}  {sit_stake/50_000:.2f}x")
assert stake - deployed > sit_stake - 50_000, "follow-on should win on dollars"
assert stake / deployed < sit_stake / 50_000, "sit-out should win on multiple"
print("   the two answers disagree ... CONFIRMED (more dollars, worse multiple)")

# viz 4: fee drag on the running deal
v4 = fees(192_000, 50_000, 0.02, 0.20)
eq("viz4 carry", v4["carry"], 28_400); eq("viz4 net", v4["net"], 163_600)
eq("viz4 gross x", v4["gross_x"], 3.84); eq("viz4 net x", v4["net_x"], 163_600 / 51_000)
print(f"4  fee drag .................. ${192_000:,} gross -> ${v4['net']:,.0f} net   "
      f"{v4['gross_x']:.2f}x -> {v4['net_x']:.2f}x")
seg = 323.7 + 56.2 + 4.0
print(f"   bar segments drawn ........ net {323.7/380:.1%} + carry {56.2/380:.1%} of the bar")

# IRR sanity
def irr(flows):
    def npv(r): return sum(cf / (1 + r) ** t for t, cf in flows)
    lo, hi = -0.9999, 10.0
    if npv(lo) * npv(hi) > 0: return None
    for _ in range(200):
        mid = (lo + hi) / 2
        if npv(lo) * npv(mid) <= 0: hi = mid
        else: lo = mid
    return (lo + hi) / 2
r = irr([(0, -50_000), (6, 192_000)])
eq("IRR closed form", r, (192_000 / 50_000) ** (1 / 6) - 1, 1e-6)
print(f"\nIRR  $50k -> $192k over 6y .... {r:.2%}   (closed form agrees)")
assert irr([(0, -50_000), (6, -1_000)]) is None
print("IRR  no sign change ........... returns None, not a garbage number")

# ---------- fixture emitted for the TypeScript tests ----------
def emit_fixture(path):
    """Values the engine's own tests assert against, so the two implementations
    cannot drift apart silently. Money is in cents; ownership is a fraction."""
    import json
    cents = lambda major: round(major * 100)
    fixture = {
        "_": "Generated by tools/oracle.py --emit. Do not edit by hand.",
        "seedRound":  {"preMoneyCents": cents(8e6),  "raisedCents": cents(2e6)},
        "seriesB":    {"preMoneyCents": cents(24e6), "raisedCents": cents(6e6)},
        "seriesBPool": 0.10,
        "entryCents": cents(50_000),
        "A": {"ownership": a, "postMoneyCents": cents(10e6)},
        "B": {"ownership": b, "valueCents": cents(b * 30e6), "postMoneyCents": cents(30e6)},
        "C": {"proRataCents": cents(c_cheque), "ownership": c, "valueCents": cents(c * 30e6)},
        "D": {"ownership": d, "proRataCents": cents(d_cheque)},
        "I": {"ownership": c_own, "exitCents": cents(60e6),
              "totalRaisedCents": cents(20e6), "proceedsCents": cents(i_gross)},
        "J": {"chequeCents": cents(50_000), "grossCents": cents(500_000),
              "entryPercent": 0.02, "carryPercent": 0.20,
              "outlayCents": cents(j["outlay"]), "carryCents": cents(j["carry"]),
              "netCents": cents(j["net"]), "dragCents": cents(j["drag"]),
              "grossMultiple": j["gross_x"], "netMultiple": j["net_x"]},
        "K": {"exitCents": cents(15e6), "totalRaisedCents": cents(20e6),
              "investedCents": cents(50_000), "proceedsCents": cents(k),
              "naiveCents": cents(naive)},
        "feeDrag": {"grossCents": cents(192_000), "carryCents": cents(v4["carry"]),
                    "netCents": cents(v4["net"]), "outlayCents": cents(v4["outlay"]),
                    "grossMultiple": v4["gross_x"], "netMultiple": v4["net_x"]},
        "L": {"path": l_path, "finalOwnership": l_own,
              "proRataSeriesACents": cents(l_pro_rata_a),
              "totalRaisedCents": cents(l_raised),
              "ladder": [{"valueCents": cents(r["value"]), "regime": r["regime"],
                          "lowCents": cents(r["low"]), "highCents": cents(r["high"])}
                         for r in l_ladder]},
        "M": {"exitCents": cents(250e6), "carryPercent": m_carry,
              "sitOut": {"path": [o for o, _ in m_sit["series"]],
                         "valuesCents": [cents(v) for _, v in m_sit["series"]],
                         "investedCents": cents(m_sit["invested"]), "grossCents": cents(m_sit["high"])},
              "proRata": {"path": [o for o, _ in m_pro["series"]],
                          "chequesCents": [cents(c) for c in m_pro["cheques"]],
                          "investedCents": cents(m_pro["invested"]), "grossCents": cents(m_pro["high"]),
                          "netCents": cents(m_net(m_pro["high"], m_pro["invested"]))}},
        "N": {"prevPostCents": cents(5e6),
              "steps": [{"growth": r["growth"], "sold": r["sold"], "pool": r["pool"],
                         "postMoneyCents": cents(r["post"]), "raisedCents": cents(r["raised"]),
                         "stakeFactor": r["factor"]} for r in n_steps]},
        "Q": {"entryPostCents": cents(q_post), "totalRaisedCents": cents(l_raised),
              "byCarry": [{"carryPercent": carry,
                           "covers": run["covers"],
                           "rows": [{"kind": r["kind"], "valueCents": cents(r["value"]), "regime": r["regime"],
                                     "lowCents": cents(r["low"]), "highCents": cents(r["high"]),
                                     "netLowCents": cents(r["net_low"]), "netHighCents": cents(r["net_high"]),
                                     "multipleLow": r["x_low"], "multipleHigh": r["x_high"]} for r in run["rows"]]}
                          for carry, run in q_runs.items()]},
        "convertibles": {name: {"amountCents": cents(c["amount"]), "capCents": cents(c["cap"]),
                                "capBasis": c["basis"], "raisedAtCapCents": cents(c["amount"] + c["others"]),
                                "discount": c["discount"], "interestRate": c["rate"], "years": c["years"],
                                "interestMode": c["mode"], "preMoneyCents": cents(c["pre"]),
                                "raisedCents": cents(c["raised"]), "pool": c["pool"],
                                "followOnCents": cents(c["follow"]), "convertingCents": cents(c["converting"]),
                                "route": c["route"], "ownership": c["ownership"]}
                         for name, c in conv_cases.items()},
    }
    with open(path, "w") as fh:
        json.dump(fixture, fh, indent=2)
        fh.write("\n")
    return fixture

if "--emit" in sys.argv:
    out = emit_fixture("tools/golden-cases.json")
    print()
    print(f"fixture written: tools/golden-cases.json ({len(out) - 1} entries)")

print()
print("=" * 72)
print(f"{checks} assertions across 19 golden cases and 4 visuals")
print("RESULT:", "ALL PASS — two independent models agree" if not fails else f"{len(fails)} FAILURES")
for f_ in fails: print("  FAIL", f_)
print("=" * 72)
raise SystemExit(1 if fails else 0)
