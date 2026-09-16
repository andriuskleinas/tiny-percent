import { toCents } from '../engine/money'
import { outcomesAt, runScenario } from '../engine/scenario'
import { HERO_EXAMPLE } from '../state/presets'

export const HERO_EXIT_CENTS = toCents(100_000_000)
const heroRun = runScenario(HERO_EXAMPLE)
const [atHeroExit] = outcomesAt(HERO_EXAMPLE, [HERO_EXIT_CENTS])
if (!atHeroExit || !heroRun.rounds[0]) throw new Error('The hero example could not be computed.')

/** The hero's animation, one step per round and then the exit, every figure from the engine. */
export const HERO_FACTS = {
  currency: HERO_EXAMPLE.currency,
  chequeCents: heroRun.rounds[0].investedCents,
  exitCents: HERO_EXIT_CENTS,
  steps: [
    ...heroRun.rounds.map((r) => ({
      label: r.round.label,
      exit: false,
      valuationCents: r.postMoneyCents,
      ownership: r.ownershipAfter,
      valueCents: r.stakeValueCents,
      /** Relative change in your share in this round; undefined for the entry. */
      change: r.ownershipBefore > 0 ? r.ownershipAfter / r.ownershipBefore - 1 : undefined,
    })),
    {
      label: 'Exit',
      exit: true,
      valuationCents: HERO_EXIT_CENTS,
      ownership: heroRun.finalOwnership,
      valueCents: atHeroExit.exit.highCents,
      change: undefined,
    },
  ],
} as const

/**
 * Every number "The maths, briefly" quotes, computed from the same €5,000
 * Pre-seed deal the hero animates. Nothing is typed into copy, so the worked
 * calculations cannot disagree with the calculator, and golden case L holds
 * every figure to the share ledger.
 */
const [entry, next] = heroRun.rounds
if (!entry || !next) throw new Error('The explanations need an entry and a later round.')
const withCarry = runScenario({ ...HERO_EXAMPLE, fees: { carry: { percent: 0.2, basis: 'per_deal' } } })

export const EXAMPLE_FACTS = {
  currency: HERO_EXAMPLE.currency,
  chequeCents: entry.investedCents,
  entryLabel: entry.round.label,
  preMoneyCents: entry.postMoneyCents - entry.round.raisedCents,
  raisedCents: entry.round.raisedCents,
  postMoneyCents: entry.postMoneyCents,
  initialOwnership: entry.ownershipAfter,
  /** The first round after the entry, which every dilution and pro-rata example uses. */
  next: {
    label: next.round.label,
    raisedCents: next.round.raisedCents,
    postMoneyCents: next.postMoneyCents,
    sold: next.round.raisedCents / next.postMoneyCents,
    kept: next.ownershipAfter / next.ownershipBefore,
    ownership: next.ownershipAfter,
    valueCents: next.stakeValueCents,
    proRataCents: next.proRataCents,
    proRataValueCents: Math.round(next.ownershipBefore * next.postMoneyCents),
  },
  /** Each later round's share of your stake kept, in order. */
  later: heroRun.rounds.slice(1).map((r) => ({ label: r.round.label, kept: r.ownershipAfter / r.ownershipBefore })),
  finalOwnership: heroRun.finalOwnership,
  totalRaisedCents: HERO_EXAMPLE.exit.totalRaisedCents,
  exitCents: HERO_EXAMPLE.exit.valueCents,
  exitProceedsCents: heroRun.exit.highCents,
  exitMultiple: heroRun.feesHigh.netMultiple,
  carry: {
    percent: 0.2,
    carryCents: withCarry.feesHigh.carryCents,
    netCents: withCarry.feesHigh.netCents,
    netMultiple: withCarry.feesHigh.netMultiple,
  },
} as const
