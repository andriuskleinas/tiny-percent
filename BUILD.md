# Build Checklist

Task-level breakdown of [PLAN.md](PLAN.md). Six phases, 11.5 days, strictly
sequential. Each task names the file it touches. Each phase ends on a check that
either passes or does not.

**Verification status:** all 11 golden cases and every number in the four visuals
are confirmed by `tools/oracle.py`, which implements the angel-side formula and an
independent share-count cap table and asserts they agree. 54 assertions, all
passing. Run it any time with `python3 tools/oracle.py`. It is the oracle the
TypeScript tests are written against.

---

## Phase 00 — Scaffold · 0.5d · DONE

| | Task | Touches |
|---|---|---|
| 0.1 | Vite + React + TypeScript, strict mode on, versions pinned | `package.json`, `tsconfig.json` |
| 0.2 | Tailwind wired, palette and type scale as tokens | `src/index.css` |
| 0.3 | Vitest configured, `npm test` runs | `vitest.config.ts` |
| 0.4 | ESLint rule forbidding `ui/**` and `state/**` imports inside `engine/**` | `eslint.config.js` |
| 0.5 | CI: typecheck, lint, test, build | `.github/workflows/ci.yml` |
| 0.6 | Static host connected, preview deploy on pull requests | *needs your Cloudflare or Vercel account* |

**Done when** CI is green on a trivial pull request and its preview URL loads.

Verified locally: typecheck, lint, 3 tests, production build and the oracle all
pass. The boundary rule was proved to fire by planting a violating import. The
app mounts with both themes resolving and no horizontal scroll at 375 pixels.
Task 0.6 is the one step left and it needs your hosting account.

---

## Phase 01 — Ownership engine · 1.5d · DONE

| | Task | Touches |
|---|---|---|
| 1.1 | Integer-cent helpers and the rounding policy | `engine/money.ts` |
| 1.2 | The `Scenario` interfaces exactly as specified in the plan | `engine/types.ts` |
| 1.3 | Golden cases A–D written first, failing | `engine/ownership.test.ts` |
| 1.4 | `ownAfter` and `proRata`, both with the option pool term | `engine/ownership.ts` |
| 1.5 | Pool constraint `t < P/V` raising a typed, readable error | `engine/ownership.ts` |
| 1.6 | Follow-on break-even solver | `engine/ownership.ts` |
| 1.7 | Property tests over randomised inputs | `engine/ownership.test.ts` |

**Done when** A–D pass, the pool constraint produces a readable error rather than
a NaN, and the property tests hold over ten thousand random scenarios.

All met. 32 tests across four files. The engine's tests assert against a fixture
the oracle emits, and CI fails if regenerating it changes anything, so the Python
and TypeScript models cannot drift apart. Both guards were proved to fire by
planting a failure.

One change to the plan: `followOnBreakEven` dropped its `ownBefore` parameter.
The break-even is exactly the post-money paid and genuinely does not depend on
your existing stake, so the signature now says so. Deriving it by subtracting the
two ownerships lost precision on small cheques — a one-cent cheque into a $500M
round came out about $40 low — so the identity is computed directly and a test
checks it against the subtraction.

**Ship gate.** This is already an honest, useful calculator. Deploy here.

---

## Phase 02 — Instruments · 1.5d · DONE

| | Task | Touches |
|---|---|---|
| 2.1 | Cases E–H written first, failing | `engine/instrument.test.ts` |
| 2.2 | `accrue`, simple and compounding | `engine/instrument.ts` |
| 2.3 | `convert`: cap route, discount route, lower effective valuation wins | `engine/instrument.ts` |
| 2.4 | All six types mapped onto the three code paths | `engine/instrument.ts` |
| 2.5 | Pre-money SAFE taking `otherConvertingCents`, result marked an estimate | `engine/instrument.ts` |
| 2.6 | Maturity outcomes for loans: convert, repay, extend | `engine/instrument.ts` |

**Done when** E–H pass, every type resolves to a path, and no case ever applies
both the cap and the discount.

All met. 75 tests across five files. A test enumerates every type and asserts it
resolves to a path, a cap basis and an accrual rule, so adding a type without
wiring it up fails the suite.

One derivation worth recording. A pre-money cap converts against the pre-money
capitalisation, so everything converting alongside dilutes everything else.
Working that through the share ledger, the holder ends up with
`amount / (cap + amount + others)`, which is identical to a post-money cap of
`cap + amount + others`. That lets both kinds of cap run through the single
formula rather than needing a second code path. Because this is a derivation
rather than a given, the oracle checks it against an independent share ledger,
and the engine asserts against that result.

---

## Phase 03 — Exit and fees · 1.5d · DONE

| | Task | Touches |
|---|---|---|
| 3.1 | Cases I–K written first, failing | `engine/exit.test.ts` |
| 3.2 | Two regimes plus the band, regime returned with every result | `engine/exit.ts` |
| 3.3 | Unconverted loan repaid ahead of equity | `engine/exit.ts` |
| 3.4 | Entry fee: percent, fixed, greater-of; on-top or deducted | `engine/fees.ts` |
| 3.5 | Management fee and carry with an optional hurdle | `engine/fees.ts` |
| 3.6 | IRR by bisection with Newton refinement, undefined on unsigned flows | `engine/irr.ts` |
| 3.7 | Timeline runner keeping every intermediate state | `engine/scenario.ts` |

**Done when** I–K pass, no exit figure can be produced without a regime label, and
IRR returns undefined rather than a number when the cash flows never change sign.

All met, and the engine is complete: 142 tests across nine files, 11 of 11 golden
cases green. The scenario runner reproduces the fee drag figure the plan
illustrates, to the cent.

Two decisions the plan left open, now settled and documented. The band between
the regimes needed a threshold, and it is twice the capital raised: preferred
convert once their as-converted share beats their preference, which holds at 2x
unless preferred own less than half the company. It is a parameter, not a
constant. And inside that band, fees and returns are computed twice, once
against each bound, rather than against an invented midpoint.

The rate of return uses bisection before a Newton polish. Newton alone is unsafe
here because net present value is badly behaved near minus one hundred percent,
which is exactly where a failed angel investment sits.

---

## Phase 04 — Interface · 4.5d · DONE

| | Task | Touches |
|---|---|---|
| 4.1 | Theme tokens, light and dark, both fully defined | `src/index.css` |
| 4.2 | Summary strip, always visible | `ui/SummaryStrip.tsx` |
| 4.3 | Entry screen, fields driven by instrument type | `ui/Entry/` |
| 4.4 | Rounds timeline, add and remove | `ui/Rounds/` |
| 4.5 | Follow-on three-column comparison | `ui/FollowOn/` |
| 4.6 | Exit screen with the itemised fee drag | `ui/Exit/` |
| 4.7 | Visual 1, area equals wealth | `ui/charts/AreaWealth.tsx` |
| 4.8 | Visual 2, the value bridge | `ui/charts/ValueBridge.tsx` |
| 4.9 | Visual 3, follow-on divergence | `ui/charts/Divergence.tsx` |
| 4.10 | Visual 4, fee drag bar | `ui/charts/FeeDrag.tsx` |

**Done when** a newcomer models a two-round deal with a follow-on without
instructions, all four visuals redraw from the live scenario, and every ownership
figure sits beside its value figure.

All met. 152 tests. The page opens on the worked example rather than an empty
form, all four visuals are computed from live state, and no ownership figure
appears anywhere without its value beside it.

Two bugs found by exercising the interface rather than by reasoning.

Typing an impossible option pool blanked the entire page. The engine's throw is
deliberate and correct, but it reached React's render. Every scenario run now
goes through a guard that keeps the last workable result on screen and explains
the problem, leaving every field editable. The follow-on panel re-runs the
scenario with decisions swapped, so it had to be guarded too and is handed the
last workable scenario rather than the broken one.

A convertible loan the angel chooses not to convert recorded no capital
deployed, so the multiple read zero. The money left the angel's account whether
or not it became shares. Both are covered by regression tests.

---

## Phase 05 — Ship · 2d · DONE

| | Task | Touches |
|---|---|---|
| 5.1 | Scenario to base64url and back, version-aware | `state/url.ts` |
| 5.2 | Saved scenarios in localStorage, wrapped in try/catch | `state/storage.ts` |
| 5.3 | Worked presets, starting with the running example from the plan | `state/presets.ts` |
| 5.4 | Accessibility: focus states, labels, keyboard order | across `ui/` |
| 5.5 | Responsive down to 320 pixels | across `ui/` |
| 5.6 | Production deploy | host config |

**Done when** a shared link reopens the exact scenario in a clean browser,
keyboard navigation reaches every control, and nothing scrolls horizontally at
320 pixels wide.

All met, verified in the browser rather than argued. A link built by editing two
fields reopened in a clean tab with both fields and every derived figure intact,
at 997 characters. At 320 pixels the document scroll width is exactly 320 with no
element overflowing its container.

A shared link is untrusted input from whoever sent it, so it is validated field
by field rather than parsed and cast, including a reviver that drops `__proto__`
so a crafted link cannot reach `Object.prototype`. Twenty-four tests cover the
round trip and every malformed, tampered and hostile case. The app additionally
checks a decoded link actually runs before opening it, because a structurally
valid scenario can still be one the engine refuses.

Lint found a real defect during this phase: the fallback that keeps the last
workable result on screen was running as an effect, which both broke the rules
of hooks on one path and caused a cascading render on every keystroke. It now
lives in the reducer, where the engine runs once per change and there is no
effect at all. Zero lint warnings remain.

---

## Where it ended up

| | |
|---|---|
| Tests | 213 across 16 files |
| Golden cases | 11 of 11 |
| Oracle assertions | 58 |
| Runtime dependencies | React, and nothing else |
| Rendered UI tests | Testing Library and jsdom, dev-only |
| Lint warnings | 0 |

## After v1: making every figure trustworthy

Four defects found by reading the shipped code and driving the page, each now
guarded by a test that renders the real component.

- **Editing the entry fee deleted a fixed minimum.** The percentage field sent
  the fee rule along with the value, so touching it switched a greater-of fee to
  percentage-only and changed the result silently. Each field now patches only
  its own term.
- **Currency was ignored.** Scenarios carried a currency but every figure,
  chart label, input prefix and the engine's own exit explanation printed
  dollars. The currency is now chosen on screen and reaches all of them.
- **Two fee terms had no inputs.** The engine supported a management fee and a
  fixed-minimum entry fee, and links could carry them, but nobody could edit
  them. Both are now on screen, showing only the fields each basis uses.
- **The fee bar drew past its own total.** Entry and management fees were drawn
  as a segment of the gross proceeds bar, but they are paid on the way in, never
  out of the proceeds. The bar now divides only net and carry, which sum to the
  gross exactly, and states the fees underneath.

## Running check

`python3 tools/oracle.py` must stay green for the life of the project. If a
TypeScript test and the oracle ever disagree, the oracle is right until proven
otherwise, because it is two independent models agreeing rather than one.

## Simplification: one cheque per round, one currency

The form was cut back to what an angel types in most deals.

- **Your entry is the first round.** There is no separate entry object; every
  round has an optional cheque, and `rounds[0]` must have one. Each follow-on
  round compares sitting out, the cheque you typed, and the pro-rata cheque.
- **Instruments are labels.** SAFE, convertible loan and priced equity all buy
  `amount / post-money` at the round they are written into. Caps, discounts,
  interest, pre-money SAFEs, ASA, KISS and the unconverted-loan exit are gone,
  and `instrument.ts` with them. The selector stays, and every instance of it says in
  place that it is a label and that caps, discounts and interest are not
  modelled, so picking one does not imply a difference that is not there.
- **Fees are simpler.** The entry fee sits on each cheque and always comes out
  of it; the management fee always comes out of capital; there is no carry
  hurdle. The oracle's fee case was updated with the TypeScript, so the two
  agreeing does not independently confirm this rule.
- **One currency per scenario.** Rounds briefly had their own currency switch,
  but nothing supplied an exchange rate, so a euro entry and a dollar follow-on
  were added one for one. The scenario now has exactly one currency, set in the
  entry panel; switching it relabels every amount and converts nothing. A test
  asserts there is only one currency switch on the page.
- **Removed:** saved scenarios, the summary strip, the value bridge and the
  follow-on divergence charts. GBP is no longer offered.
- **Links are version 2.** Version 1 links from before this change are refused,
  not migrated.

The entry-fee editing guards from the fix pass were deleted with the old fee
shape and have been restored against the per-cheque fee, for the entry panel
and for a follow-on round.

| | |
|---|---|
| Tests | 149 across 15 files |
| Oracle assertions | 43 |
| Lint warnings | 0 |

---

## Landing page PRD — Phase 1: the calculator · DONE, awaiting review

The calculator reshaped to PRD §11–26. The landing sections around it are
Phase 2.

| | Done |
|---|---|
| Your initial investment | Ownership is the headline result, with investment amount, total paid, post-money and paper value. Instrument, option pool and entry fee sit under "More terms". |
| Money inputs | Thousands separators on blur; "5k", "4m", "1bn" accepted while typing. |
| Start from scratch / Load example | Scratch empties every amount and the engine runs a blank form to zeros; the example is the €5,000 deal. |
| Future funding rounds | "+ Add funding round", custom round names, a round-by-round table (cards on a phone), pro-rata quoted on every round with "Invest pro-rata", and no follow-on / your follow-on / maintain pro-rata side by side. |
| Exit | €10M–€1B presets plus a custom value, potential gross proceeds, MOIC, IRR, a comparison table, and the PRD's short disclaimer. |
| Summary | Beside the calculator on wide screens; a one-line bar pinned to the bottom on narrow ones. |
| Explanations | Thirteen terms in `ui/glossary.ts`, behind keyboard-operable info buttons that close on Escape and stay inside a 320px screen. |
| Sharing | System share sheet on touch devices, clipboard elsewhere, and the link to copy by hand if both are refused. |

**Numbers.** Every figure the page shows about the example is computed, and
golden case L in `tools/oracle.py` checks it against the share ledger:
0.10% → 0.08% → 0.064% → 0.0512%, €128,000 and 25.6× at €250M, and each row of
the exit table including its preference regime. At €10M and €25M the preference
stack decides the answer, at €50M it is a range, and the table marks all three.

**Fees are now paid on top of the cheque.** The simplification had the entry
fee "come out of the cheque" for carry while the whole cheque still bought
shares, which counted the same money twice. PRD §12 separates "investment
amount" from "total amount paid", so both fees are now charged on top: the
cheque buys shares, carry is charged on profit above the cheque, and outlay is
cheque plus fees. This restores golden case J to the figures the oracle
originally verified ($51,000 outlay, $90,000 carry). Fees default to none.

**Defects found and fixed while building it.**

- Typing an amount before a valuation blanked the page. The exit table and the
  follow-on comparison ran the engine on the typed scenario instead of the last
  workable one. Both now use the workable one, with a regression test.
- A post-money valuation below the amount raised produced a negative pre-money
  and a nonsense ownership. It is now refused with a message asking whether it
  was meant as pre-money.
- The next-round guess read a post-money valuation as if it were pre-money.
- Faint text failed WCAG AA in both themes (3.1:1 light). The ink tokens are
  now at least 4.5:1 on every surface they sit on, and text on the accent
  colour has its own token so dark mode no longer puts white on light blue.
- Two regions were both named "Your investment"; the first is now "Your
  initial investment".

| | |
|---|---|
| Tests | 204 across 17 files |
| Oracle assertions | 53 across 8 golden cases |
| Lint warnings | 0 |
| Checked in the browser | 1440px light and dark, 320px with no horizontal scroll, every info popup in bounds |
