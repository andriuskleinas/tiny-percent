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

> **Use `npm ci`, not `npm install`.** npm 10's peer resolver crashes building
> vitest 4's dependency tree from scratch. Installing from the committed lockfile
> avoids it. If you must add a dependency, install it on its own with
> `--legacy-peer-deps`.

## The oracle

`tools/oracle.py` implements the same maths twice: the angel-side formula from the
plan, and an independent share-count cap table that knows nothing about it. It
asserts the two agree across all 11 golden cases and every figure in the four
visuals — 54 assertions.

It runs in CI. If a TypeScript test and the oracle ever disagree, the oracle is
right until proven otherwise, because it is two models agreeing rather than one.

## The engine boundary

Nothing under `src/engine/` may import from `src/ui/`, `src/state/`, or React. The
calculation core is plain TypeScript so it stays portable and testable on its own.
`src/engine/architecture.test.ts` enforces this and runs in `npm test`.

## Status

| Phase | | |
|---|---|---|
| 00 | Scaffold | done |
| 01 | Ownership engine | next |
| 02 | Instruments | |
| 03 | Exit and fees | |
| 04 | Interface | |
| 05 | Ship | |

Golden cases green: 0 of 11.
