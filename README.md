# Angel Dilution Calculator

What your cheque buys, what the next rounds take back, and what survives the
syndicate's carry. Modelled entirely from the angel's chair, using only numbers an
angel can actually get.

- [PLAN.md](PLAN.md) — the specification: maths, instruments, visuals, data model
- [BUILD.md](BUILD.md) — task-level phase breakdown and definitions of done

## Running it

```bash
npm ci
npm run dev
```

```bash
npm run check    # typecheck, lint, tests — the same gate CI runs
npm run oracle   # verifies the plan's own numbers
```

> **Adding a dependency needs `--legacy-peer-deps`.** npm 10's peer resolver
> crashes while building vitest 4's dependency tree from scratch. Installing from
> the committed lockfile is unaffected, so `npm install` and `npm ci` both work on
> a normal clone. It only bites when resolving a new package, so add one with
> `npm install -D <pkg> --legacy-peer-deps`.

## The oracle

`tools/oracle.py` implements the same maths twice: the angel-side formula from the
plan, and an independent share-count cap table that knows nothing about it. It
asserts the two agree across all 11 golden cases and every figure in the four
visuals — 54 assertions.

`npm run oracle:emit` writes `tools/golden-cases.json`, and the engine's tests
assert against that file. CI regenerates it and fails if it differs from what is
committed, so the Python and TypeScript implementations cannot drift apart
quietly.

If a TypeScript test and the oracle ever disagree, the oracle is right until
proven otherwise, because it is two models agreeing rather than one.

## The engine boundary

Nothing under `src/engine/` may import from `src/ui/`, `src/state/`, or React. The
calculation core is plain TypeScript so it stays portable and testable on its own.
`src/engine/architecture.test.ts` enforces this and runs in `npm test`.

## Status

| Phase | | |
|---|---|---|
| 00 | Scaffold | done |
| 01 | Ownership engine | done |
| 02 | Instruments | done |
| 03 | Exit and fees | done |
| 04 | Interface | done |
| 05 | Ship | done |

Golden cases green: 11 of 11. All six phases are complete.

## Sharing

The address bar always holds the current scenario, base64url-encoded in the hash,
so copying the link from anywhere shares that exact deal. A link is untrusted
input from whoever sent it, so `src/state/url.ts` validates it structurally
field by field and the app additionally checks it runs before opening it. A
malformed, tampered or impossible link falls back to the worked example rather
than opening onto an error.

Saved scenarios live in this browser only, in localStorage. That store is
editable by hand, so what comes back out is validated the same way a link is. A
browser that refuses to store anything simply has no saved scenarios.

## The interface never lets an engine throw reach render

The engine throws by design on inputs with no answer, such as an option pool at
or above the pre-money share. A throw during React's render blanks the whole page
and strands the user with no way to correct what they just typed. Every scenario
run in the interface therefore goes through `src/ui/safeRun.ts`, which keeps the
last workable result on screen and explains what is wrong. `safeRun.test.ts`
guards it.
