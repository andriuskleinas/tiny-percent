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

def convert(amount, cap, discount, pre, raised):
    V = pre + raised
    routes = []
    if cap:      routes.append(cap * V / pre)
    if discount: routes.append(V * (1 - discount))
    if not routes: routes.append(V)          # priced equity
    return amount / min(routes)

def convert_pre_cap(amount, cap, others, discount, pre, raised):
    """A pre-money cap behaves exactly like a post-money cap of cap+amount+others,
       because everything converting at that price dilutes everything else."""
    return convert(amount, cap + amount + others, discount, pre, raised)

def accrue(principal, rate, years, mode="simple"):
    return principal * (1 + rate * years) if mode == "simple" else principal * (1 + rate) ** years

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
    def convert_at_pre_cap(self, amount, cap, others):
        # Conversion price is the cap divided by the pre-conversion share count,
        # so simultaneous converters dilute one another.
        price = cap / self.total
        mine, theirs = amount / price, others / price
        self.total += mine + theirs
        self.angel += mine
    def convert_at_post_cap(self, amount, cap_fraction):
        # holder ends up owning cap_fraction of the company pre-new-money
        s = self.total * cap_fraction / (1 - cap_fraction)
        self.total += s
        self.angel += s
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

# E: post-money SAFE
e_conv = 100_000 / 5e6
e = convert(100_000, cap=5e6, discount=0, pre=8e6, raised=2e6)
eq("E at conversion", e_conv, 0.02); eq("E after round", e, 0.016)
L6 = Ledger(); L6.convert_at_post_cap(100_000, e_conv)
eq("E ledger at conversion", L6.own(), 0.02)
L6.priced_round(8e6, 2e6)
eq("E ledger after round", L6.own(), e)
print(f"E  $100k SAFE @ $5M cap ....... {e_conv:.4%} -> {e:.4%}      [ledger {L6.own():.4%}]")

# E2: pre-money cap, the one formula the angel-side model cannot see all of
pre_amt, pre_cap, pre_other = 100_000, 5e6, 400_000
e2 = convert_pre_cap(pre_amt, pre_cap, pre_other, 0, 8e6, 2e6)
e2_at_conv = pre_amt / (pre_cap + pre_amt + pre_other)
eq("E2 at conversion", e2_at_conv, 100_000 / 5_500_000)
eq("E2 after round", e2, e2_at_conv * 0.8)
L8 = Ledger(); L8.convert_at_pre_cap(pre_amt, pre_cap, pre_other)
eq("E2 ledger at conversion", L8.own(), e2_at_conv)
L8.priced_round(8e6, 2e6)
eq("E2 ledger after round", L8.own(), e2)
e2_solo = convert_pre_cap(pre_amt, pre_cap, 0, 0, 8e6, 2e6)
assert e2_solo > e2, "other converters must dilute you"
assert e2_solo < e, "a pre-money cap must be worse than the same post-money cap"
print(f"E2 $100k pre-money cap @ $5M ... {e2_at_conv:.4%} -> {e2:.4%}      [ledger {L8.own():.4%}]")

# F: CLA with interest
f_amt = accrue(50_000, 0.08, 2, "simple")
f_eff = min(5e6 * 10e6 / 8e6, 10e6 * 0.8)
f = convert(f_amt, cap=5e6, discount=0.20, pre=8e6, raised=2e6)
eq("F converting amount", f_amt, 58_000)
eq("F effective valuation", f_eff, 6.25e6)
eq("F ownership", f, 0.00928)
L7 = Ledger(); L7.convert_at_post_cap(f_amt, f_amt / 5e6); L7.priced_round(8e6, 2e6)
eq("F ledger agrees", L7.own(), f)
print(f"F  $50k CLA 8%/2yr ............ ${f_amt:,.0f} at ${f_eff/1e6:.2f}M -> {f:.4%}  [ledger {L7.own():.4%}]")

# G: same terms, no interest
g = convert(50_000, cap=5e6, discount=0.20, pre=8e6, raised=2e6)
eq("G ownership", g, 0.008)
eq("G accrual uplift", f / g - 1, 0.16)
print(f"G  identical, no interest ..... {g:.4%}   accrual worth +{f/g-1:.1%} ownership")

# H / I: exit values
c_own = own_after(b, 48e6, 12e6)
eq("Series C sit-out ownership", c_own, 0.0032)
i_gross = c_own * 60e6
eq("I gross proceeds", i_gross, 192_000)
h_gross = f * 60e6
print(f"H  case F at $60M exit ........ ${h_gross:,.0f} on {f:.4%}, invested stays $50,000")
print(f"I  0.32% of $60M .............. ${i_gross:,.0f}")

# J: fees
def fees(gross, deployed, entry_pct, carry_pct, charged="on_top"):
    entry = deployed * entry_pct
    outlay = deployed + entry if charged == "on_top" else deployed
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
        "convertRound": {"preMoneyCents": cents(8e6), "raisedCents": cents(2e6)},
        "E": {"amountCents": cents(100_000), "capCents": cents(5e6),
              "ownershipAtConversion": e_conv, "ownership": e,
              "effectiveValuationCents": cents(6.25e6)},
        "E2": {"amountCents": cents(pre_amt), "capCents": cents(pre_cap),
               "otherConvertingCents": cents(pre_other),
               "ownershipAtConversion": e2_at_conv, "ownership": e2},
        "F": {"amountCents": cents(50_000), "capCents": cents(5e6), "discount": 0.20,
              "rate": 0.08, "years": 2, "convertingCents": cents(f_amt),
              "effectiveValuationCents": cents(f_eff), "ownership": f,
              "investedCents": cents(50_000)},
        "G": {"ownership": g, "accrualUplift": f / g - 1},
        "H": {"exitCents": cents(60e6), "proceedsCents": cents(f * 60e6)},
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
print(f"{checks} assertions across 11 golden cases and 4 visuals")
print("RESULT:", "ALL PASS — two independent models agree" if not fails else f"{len(fails)} FAILURES")
for f_ in fails: print("  FAIL", f_)
print("=" * 72)
raise SystemExit(1 if fails else 0)
