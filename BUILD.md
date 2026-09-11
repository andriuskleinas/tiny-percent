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

## Phase 04 — Interface · 4.5d

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

---

## Phase 05 — Ship · 2d

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

---

## Running check

`python3 tools/oracle.py` must stay green for the life of the project. If a
TypeScript test and the oracle ever disagree, the oracle is right until proven
otherwise, because it is two independent models agreeing rather than one.
