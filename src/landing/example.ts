import { toCents } from '../engine/money'
import { outcomesAt, runScenario } from '../engine/scenario'
import { EXAMPLE } from '../state/presets'

/**
 * Every number the landing page quotes about the €5,000 example, computed once
 * from the same preset "Load example" opens. Nothing here is typed into copy,
 * so the hero, the worked example, the explanations and the calculator cannot
 * disagree — and golden case L holds all of it to the share ledger.
 */

const run = runScenario(EXAMPLE)
const [entry, seriesA] = run.rounds
if (!entry || !seriesA) throw new Error('The example needs an entry and a Series A.')

export const HERO_EXIT_CENTS = toCents(100_000_000)
const [atHeroExit] = outcomesAt(EXAMPLE, [HERO_EXIT_CENTS])
if (!atHeroExit) throw new Error('The hero exit could not be computed.')

export const EXAMPLE_FACTS = {
  currency: EXAMPLE.currency,
  chequeCents: entry.investedCents,
  preMoneyCents: entry.postMoneyCents - entry.round.raisedCents,
  raisedCents: entry.round.raisedCents,
  postMoneyCents: entry.postMoneyCents,
  initialOwnership: entry.ownershipAfter,
  rounds: run.rounds.slice(1).map((r) => ({
    label: r.round.label,
    raisedCents: r.round.raisedCents,
    postMoneyCents: r.postMoneyCents,
    ownership: r.ownershipAfter,
    valueCents: r.stakeValueCents,
  })),
  path: run.rounds.map((r) => ({ label: r.round.label, ownership: r.ownershipAfter })),
  seriesA: {
    raisedCents: seriesA.round.raisedCents,
    postMoneyCents: seriesA.postMoneyCents,
    ownership: seriesA.ownershipAfter,
    valueCents: seriesA.stakeValueCents,
    proRataCents: seriesA.proRataCents,
    keptShare: seriesA.ownershipAfter / seriesA.ownershipBefore,
  },
  finalOwnership: run.finalOwnership,
  totalRaisedCents: EXAMPLE.exit.totalRaisedCents,
  exitCents: EXAMPLE.exit.valueCents,
  exitProceedsCents: run.exit.highCents,
  exitMultiple: run.feesHigh.netMultiple,
  heroExitProceedsCents: atHeroExit.exit.highCents,
} as const
