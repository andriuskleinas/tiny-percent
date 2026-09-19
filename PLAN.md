# Angel Dilution Calculator — Build Plan

Final. Public web app, no accounts. React + TypeScript + Vite + Tailwind.

**Scope rule: everything is modelled from the angel's chair.** The only inputs are
things an angel knows or can ask for: what they put in, on what instrument, what
the company raised, at what valuation, and what it exited for. No share ledger, no
founder split, no employee options, no other holders.

---

## 1. The one formula

The angel's ownership is a single fraction and every round multiplies it. That is
algebraically identical to running a full cap table, as long as you only ever ask
about one holder.

For a round raising `R` at pre-money `P`, post-money `V = P + R`, where `t` is any
new option pool created in that round as a fraction of post-money:

```
own_after = own_before * (P / V - t)           if you sit out
own_after = own_before * (P / V - t) + I / V   if you put in I

pro_rata  = own_before * (R + t * V)           to hold your position
```

Set `t = 0` and it reduces to the two rules every angel knows: your stake
multiplies by pre over post, and your pro-rata is your percentage of the round.

Verified against a share-count model: a 0.50% holder facing a $6M raise at $24M
pre with a new 10% pool lands at 0.35%, and holding 0.50% costs $45,000. Both
match the ledger to the cent.

**Validate:** `t < P / V`. Outside that there is no solution.

Also compute the **follow-on break-even**: the exit valuation above which writing
the pro-rata cheque beats keeping the money.

---

## 2. Visuals

Words explain dilution badly. Four figures carry the mechanics, each answering one
question, all drawn from the same worked deal. All four are hand-rolled SVG and
belong to phase 04. Each is drawn from the live scenario, so changing an input
redraws it rather than showing a canned illustration.

### 2.1 Area equals your wealth — the hero figure

Three rectangles, one per round. **Width is your ownership percentage, height is
the company valuation, so the area is what your stake is worth.** The shapes get
narrower and taller, and they get bigger.

```
Series A   0.50% of $10M    wide and short    area = $50k
Series B   0.40% of $30M    narrower, taller  area = $120k
Series C   0.32% of $60M    narrow and tall   area = $192k
```

Ownership falls by a third while the stake nearly quadruples. This opens the
follow-on screen. A calculator showing only the falling percentage teaches the
opposite, which is the most common misunderstanding in angel investing.

### 2.2 The value bridge — where the change came from

One round decomposed into its two opposing forces.

```
$50k  ->  +$100k valuation  ->  -$30k dilution  ->  $120k
start     company tripled       0.50% to 0.40%     at Series B
```

Sits under every round row in the timeline. It answers the question people
actually ask when a number moves: how much of this was the company doing well,
and how much was me being cut down. In a down round the middle bar goes negative
and both forces point the same way, which is exactly when an angel needs it.

### 2.3 Follow-on divergence — should I write the cheque

Two lines, same deal, one following every pro-rata and one never following.

| Path | Deployed | Stake at Series C | Gain | Multiple |
|---|---|---|---|---|
| Follow on | $140,000 | $300,000 | $160,000 | 2.1x |
| Sit out | $50,000 | $192,000 | $142,000 | 3.8x |

The figure earns its place because **the two answers disagree**. Following on
returns more dollars on a worse multiple. Which wins depends on what else that
capital could have done, so show both and let the angel decide rather than
declaring a winner.

### 2.4 Fee drag — what the syndicate took

Exit proceeds as one bar, cut to scale into what reaches you and what does not.

```
$192,000 gross  =  $163,600 net to you  +  $28,400 carry  +  $1,000 entry fee
gross 3.84x                                net 3.21x
```

Twenty percent carry on a 3.8x deal costs more than most angels expect, and a
block of the bar lands harder than a line in a table. The entry fee is drawn at
its real size, which is a sliver. The fee that matters is almost never the one
people negotiate.

### 2.5 Rules for all four

Every ownership figure appears beside its value figure, in every visual and every
table, without exception. Colour carries meaning and nothing else: one hue for
growth, one for dilution and fees, the accent for neutral totals. All four use the
theme tokens so they stay legible in light and dark. Wide figures scroll inside
their own container. None needs a charting library.

---

## 3. Instruments

Type is not a label. It changes the answer three ways: when ownership is fixed,
how much money converts, and where you sit at a bad exit.

### 3.1 One formula covers all of them

```
converting_amount   = A * interest_factor
effective_valuation = min(cap * V / P, V * (1 - discount))
ownership           = converting_amount / effective_valuation
```

`interest_factor` is 1 for anything that does not accrue. Priced equity is the
degenerate case with no cap, no discount and no interest, falling back to `A / V`.

The cap route reads as `cap * V / P` because a post-money cap fixes ownership at
`A / cap` before the new money lands, and the round then dilutes it by `P / V`.
Taking the **lower of the two effective valuations** is taking the better of cap
and discount. You get one or the other, never both.

### 3.2 The six types

| Type | Fields it adds | Engine path |
|---|---|---|
| Priced equity | valuation only | ownership fixed at once |
| SAFE, post-money cap | cap, discount | conversion, no accrual |
| SAFE, pre-money cap | cap, discount, other convertibles converting alongside | conversion, estimate only |
| CLA / convertible note | cap, discount, rate, simple or compounding, start and maturity | conversion with accrual |
| ASA (UK, SEIS/EIS) | cap, discount, longstop date | alias of post-money SAFE |
| KISS | depends on variant | equity variant is a SAFE, debt variant is a CLA |

Three code paths, six labels.

### 3.3 Interest accrual

```
simple:      A * (1 + r * years)
compounding: A * (1 + r) ^ years
```

Both are in the market, so make it a toggle. Years run from investment date to
conversion date.

**Critical:** accrued interest increases what converts but is not money you paid.
Invested capital for return purposes stays at `A`. A $50k loan at 8% simple over
two years converts $58,000 and buys 0.928% where a plain SAFE on identical terms
buys 0.80%. The multiple is still measured against $50,000.

### 3.4 Pre-money SAFEs and unconverted instruments

A pre-money cap converts against pre-money capitalisation, so other convertibles
converting simultaneously dilute you and you cannot see them. Support it, add one
field for the total converting alongside, default zero, label the result an
estimate. Post-money has been the default since 2018.

SAFEs and ASAs have no maturity and sit until a priced round, an exit, or the
company dies. A CLA at maturity means repay, extend, or convert at a default
valuation. Model all three as a selector on the exit screen. An unconverted loan
is repaid ahead of every equity holder.

### 3.5 What ships today (2026-09-19)

SAFEs and convertible notes are modelled for the entry cheque only: a cap (post-
or pre-money, the latter an estimate), a discount, and simple or compounding
interest for a note. Conversion happens at the round dated next after the entry.
The best final ownership wins rather than the lowest effective valuation, because
a new pool in the conversion round dilutes the cap route but not the price
routes; see BUILD.md. KISS, ASA, uncapped SAFEs and loan maturity outcomes are
not modelled.

---

## 4. Exit and fees

Preferences depend on the cap table we deliberately do not have, so the tool
reports which regime the exit falls in rather than faking precision. `T` is total
capital raised, which the angel knows.

```
clean exit, E well above T:
  proceeds = own * E

downside, E at or below T:
  proceeds = min(A_total, A_total / T * E)   equity or converted
  proceeds = min(A + accrued, E)             unconverted loan, paid first
```

Between the two, show both as a band and say the exact number needs the
preference stack. An angel on 0.32% of a company that raised $20M exiting at $15M
receives around $37,500, not the $48,000 that ownership times exit suggests. The
regime label sits next to the number, always.

**Fees.** Entry fee is a percentage or a fixed minimum, whichever is greater, with
an explicit toggle for deducted from the cheque against charged on top. Management
fee is an annual percentage over N years. Carry is a percentage of profit above
return of contributed capital with an optional hurdle, defaulting to per-deal with
no cross-deal netting, which is the syndicate norm and the worse deal.

**Returns.** Gross and net multiple on invested capital, plus net IRR from dated
cash flows. Solve NPV = 0 by bisection with Newton refinement, returning undefined
rather than a garbage number when signs never change.


**Four endings (2026-09-19).** Beside the single exit, the calculator shows the
deal at four outcomes: the company fails, sells for what it raised, or grows 10×
or 100× from the entry post-money (a SAFE's cap). Each is a full engine run,
and a line of arithmetic says how many failed cheques like this one a single win
pays back. No outside return statistics are quoted.

---

## 5. Data model

One serialisable object holds the entire scenario. It is what goes in the URL.

```ts
type Currency = 'USD' | 'EUR' | 'GBP';

type InstrumentType =
  | 'equity' | 'safe_post' | 'safe_pre'
  | 'cla' | 'asa' | 'kiss_equity' | 'kiss_debt';

interface Instrument {
  type: InstrumentType;
  amountCents: number;
  date: string;                    // ISO 8601
  capCents?: number;
  discount?: number;               // 0..1
  interestRate?: number;           // 0..1 annual
  interestMode?: 'simple' | 'compound';
  maturityDate?: string;
  otherConvertingCents?: number;   // safe_pre only
}

interface Round {
  id: string;
  label: string;
  date: string;
  raisedCents: number;
  preMoneyCents: number;           // post-money is derived, never stored
  newOptionPool?: number;          // 0..1 of post-money
  convertsHere?: boolean;          // the angel's convertible converts in this round
  angelAction:
    | { kind: 'sit_out' }
    | { kind: 'pro_rata' }
    | { kind: 'custom'; amountCents: number };
}

interface Fees {
  entry: {
    percent?: number;
    fixedCents?: number;
    rule: 'percent' | 'fixed' | 'greater_of';
    charged: 'on_top' | 'deducted';
  };
  management?: { annualPercent: number; years: number; source: 'capital' | 'invoiced' };
  carry: { percent: number; hurdlePercent?: number; basis: 'per_deal' };
}

interface ExitEvent {
  date: string;
  valueCents: number;
  totalRaisedCents: number;
  unconvertedLoan?: 'convert' | 'repay' | 'extend';
}

interface Scenario {
  version: 1;                      // bump to migrate old shared links
  currency: Currency;
  entry: Instrument;
  rounds: Round[];
  fees: Fees;
  exit: ExitEvent;
}
```

Store pre-money only and derive post-money. Storing both invites them to disagree.
The `version` field is what lets a link shared today still open in a year.

---

## 6. Screens

Five surfaces, one persistent strip.

| Screen | Contains |
|---|---|
| **Summary strip** | Always visible. Current ownership, total invested, current paper value, net multiple if an exit is set. |
| **Entry** | Instrument picker that drives which fields appear. Round terms. Result: ownership, and when it was fixed. |
| **Rounds** | The timeline. Each row: raise, valuation, pool, your action, ownership after, value after. Add or remove a round. |
| **Follow-on** | For the selected round, three columns: sit out, pro-rata, custom. Ownership after, value after, capital deployed, and the break-even exit valuation. |
| **Exit** | Exit value and date, regime badge, gross and net proceeds, itemised fee drag, multiple and IRR. |

Every ownership figure appears beside its value figure. Never one without the
other, or the product teaches that dilution is loss.

---

## 7. Architecture and dependencies

```
src/
  engine/            pure TypeScript, no UI imports, fully unit tested
    types.ts         the interfaces above
    money.ts         integer cents, explicit rounding
    ownership.ts     round multiplication, pro-rata, sit-out, break-even
    instrument.ts    one conversion formula, accrual, cap against discount
    exit.ts          the two regimes, unconverted debt seniority
    fees.ts          entry, management, carry
    irr.ts           dated cash flows
    scenario.ts      runs the timeline, keeps every intermediate state
  ui/
    SummaryStrip.tsx Entry/ Rounds/ FollowOn/ Exit/ shared/
  state/
    url.ts           scenario to base64url and back, version-aware
    storage.ts       localStorage, wrapped in try/catch
```

**Runtime dependencies: React and nothing else.** Worth stating because it is a
real finding, not an aspiration.

- **No charting library.** All four visuals and the timeline are hand-rolled SVG.
- **No decimal library.** Money is integer cents. Ownership is a plain double,
  which carries far more precision than a percentage needs, and is formatted only
  at the edge.
- **No router.** Single page, scenario lives in the URL hash.
- **No state library.** One `Scenario` object behind one reducer.
- **No compression library.** A ten-round scenario is a few hundred bytes of JSON.
  Reach for one only if a real link exceeds roughly two thousand characters.

Formatting uses `Intl.NumberFormat`, which is built in. Dev dependencies are Vite,
TypeScript, Tailwind, Vitest and ESLint.

**Enforce the boundary.** An ESLint rule forbidding `ui/` imports inside `engine/`
is what keeps the core portable and testable. Add it in phase 00, not later.

**Deploy.** Static output to any static host. Cloudflare Pages or Vercel, wired to
the default branch, with preview deploys on pull requests.

---

## 8. Build phases

| # | Phase | Deliverable | Est. |
|---|---|---|---|
| 0 | Scaffold | Vite, TS strict, Tailwind, Vitest, ESLint boundary, CI, deploy preview | 0.5d |
| 1 | Ownership engine | Entry, per-round dilution, pool term, pro-rata, custom cheques, break-even | 1.5d |
| 2 | Instruments | Conversion formula, accrual both ways, all six types, maturity outcomes | 1.5d |
| 3 | Exit and fees | Both regimes, debt seniority, entry/management/carry, MOIC, dated IRR | 1.5d |
| 4 | Interface | All five screens, type-driven fields, timeline, all four visuals | 4.5d |
| 5 | Ship | URL encoding, saved scenarios, presets, a11y, responsive QA | 2d |

**Eleven and a half days, about two focused weeks.**

### Definition of done

| # | Done when |
|---|---|
| 0 | `npm test` and `npm run build` both pass in CI, and a pull request produces a preview URL. |
| 1 | Golden cases A through D pass. The pool constraint raises a readable error, not a NaN. |
| 2 | Cases E through H pass. All six types are selectable and each renders only its own fields. |
| 3 | Cases I through K pass. Every exit figure carries a regime label. IRR returns undefined on unsigned flows. |
| 4 | A newcomer models a two-round deal with a follow-on without reading any instructions. Every ownership figure sits beside its value figure, and all four visuals redraw from the live scenario. |
| 5 | A shared link reopens the exact scenario in a clean browser. Keyboard navigation reaches every control. No horizontal scroll at 320 pixels wide. |

**Ship gate:** phases 00 and 01 alone are a working, honest calculator covering
entry, dilution and follow-on sizing. Deploy there and build the rest behind it.

---

## 9. Golden cases

Write these as failing tests before implementing. Baseline: a $50k cheque into a
$2M round at $8M pre-money.

| Case | Setup | Expected |
|---|---|---|
| A | Priced equity entry | 0.50% |
| B | Series B, $6M at $24M pre, sit out | 0.40%, stake worth $120k |
| C | Same round, pro-rata | $30,000 cheque, holds 0.50%, worth $150k |
| D | Same round plus a new 10% pool, sit out | 0.35%; pro-rata now costs $45,000 |
| E | $100k post-money SAFE at $5M cap into $8M pre / $10M post | 2.00% at conversion, 1.60% after the round |
| F | $50k CLA, 8% simple, 2 years, $5M cap, 20% discount, same round | $58,000 converts at a $6.25M effective valuation, 0.928% |
| G | Identical terms, no interest | 0.80%, so accrual is worth 16% more ownership on the same cheque |
| H | Case F at a $60M exit | proceeds on 0.928%, invested capital stays $50,000 |
| I | Exit at $60M holding 0.32% | $192,000 gross |
| J | $50k in, 2% entry fee on top, 20% carry, $500k gross | outlay $51k, carry $90k, net $410k, net 8.04x, drag $91k |
| K | Exit at $15M, $20M raised, $50k invested | $37,500, flagged as the downside regime |

**Property tests over randomised inputs.** Ownership always between zero and one.
Sitting out never increases ownership. A pro-rata cheque always returns exactly
the prior ownership. Cap route and discount route never both apply. Proceeds never
exceed the exit value.

---

## 10. Blind spots, stated in the interface

Each gets a one-line note beside the affected number rather than being hidden.

1. **Other people's convertibles.** Instruments converting alongside a round
   dilute you and are invisible from angel-side inputs. Pre-money SAFEs need that
   number outright, which is why their result carries an estimate label.
2. **Exits between the raised total and a clean multiple.** The preference stack
   decides it and we do not have the stack.
3. **Structured preferences.** Anything past 1x non-participating, including
   participating preferred and higher multiples, reads too favourably.
4. **Anti-dilution and pay-to-play.** Not modelled. Both bite hardest in exactly
   the down rounds where an angel most wants a number.

**Out of scope entirely.** Secondary purchases, tender offers, warrants, venture
debt, revenue-based financing, employee options, tax treatment (SEIS, EIS, QSBS),
multi-currency conversion, portfolio aggregation.

Secondary purchases are the most defensible v2 addition on the instrument side,
since no new money enters the company and ownership is simply price over agreed
valuation. Portfolio aggregation is the most likely v2 addition overall and needs
no new mathematics, just a list of scenarios and a sum. The `Scenario` type is
already serialisable so both drop straight in.
