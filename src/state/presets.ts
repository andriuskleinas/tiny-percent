import { toCents } from '../engine/money'
import type { Currency, Scenario } from '../engine/types'

const NO_FEE = { rule: 'percent' as const, percent: 0 }
const NO_CARRY = { carry: { percent: 0, basis: 'per_deal' as const } }

/** The hypothetical exit valuations offered as one-click choices, in major units. */
export const EXIT_PRESETS_CENTS: readonly number[] = [
  10_000_000, 25_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000,
].map(toCents)

/**
 * What a fresh visit sees: a single €5,000 cheque into a Seed round, so the
 * first result on screen is "what do I own". Follow-on rounds are for the user
 * to add. No fees — a direct investment is the simplest honest default.
 */
export const STARTING_POINT: Scenario = {
  version: 3,
  currency: 'EUR',
  rounds: [
    {
      id: 'seed',
      label: 'Seed',
      date: '2026-01-15',
      valuationCents: toCents(4_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(1_000_000),
      participation: { type: 'equity', amountCents: toCents(5_000), entryFee: NO_FEE },
    },
  ],
  fees: NO_CARRY,
  exit: {
    date: '2033-01-15',
    valueCents: toCents(100_000_000),
    totalRaisedCents: toCents(1_000_000),
  },
}

/**
 * "What happens to a €5,000 angel investment?" — the worked example behind
 * "Load example" and every figure the page quotes about it. Each later round
 * raises a fifth of its post-money, so the stake falls by a fifth each time:
 * 0.10%, 0.08%, 0.064%, 0.0512%. Held to golden case L in `tools/oracle.py`.
 */
export const EXAMPLE: Scenario = {
  version: 3,
  currency: 'EUR',
  rounds: [
    STARTING_POINT.rounds[0] as Scenario['rounds'][number],
    {
      id: 'series-a',
      label: 'Series A',
      date: '2027-09-01',
      valuationCents: toCents(15_000_000),
      valuationBasis: 'post',
      raisedCents: toCents(3_000_000),
    },
    {
      id: 'series-b',
      label: 'Series B',
      date: '2029-09-01',
      valuationCents: toCents(40_000_000),
      valuationBasis: 'post',
      raisedCents: toCents(8_000_000),
    },
    {
      id: 'series-c',
      label: 'Series C',
      date: '2031-09-01',
      valuationCents: toCents(100_000_000),
      valuationBasis: 'post',
      raisedCents: toCents(20_000_000),
    },
  ],
  fees: NO_CARRY,
  exit: {
    date: '2034-01-15',
    valueCents: toCents(250_000_000),
    totalRaisedCents: toCents(32_000_000),
  },
}

/**
 * The animated example in the hero: the same deal as `EXAMPLE`, told from a
 * Pre-seed cheque. Only the round names differ, so golden case L still holds
 * every figure it shows.
 */
const HERO_LABELS = ['Pre-seed', 'Seed', 'Series A', 'Series B']
export const HERO_EXAMPLE: Scenario = {
  ...EXAMPLE,
  rounds: EXAMPLE.rounds.map((round, i) => ({ ...round, id: `hero-${i}`, label: HERO_LABELS[i] ?? round.label })),
}

/**
 * "Start from scratch": every amount empty. The engine runs this to zeros, and
 * the page asks for an investment and a valuation instead of showing results.
 */
export function blankScenario(currency: Currency, today: Date = new Date()): Scenario {
  const date = today.toISOString().slice(0, 10)
  const exitYear = today.getUTCFullYear() + 7
  return {
    version: 3,
    currency,
    rounds: [
      {
        id: 'entry',
        label: 'Seed',
        date,
        valuationCents: 0,
        valuationBasis: 'pre',
        raisedCents: 0,
        participation: { type: 'equity', amountCents: 0, entryFee: NO_FEE },
      },
    ],
    fees: NO_CARRY,
    exit: { date: `${exitYear}${date.slice(4)}`, valueCents: 0, totalRaisedCents: 0 },
  }
}

/**
 * Dollar deals from the build plan, three rounds deep. Test fixtures: the
 * Python oracle's golden cases A–K are stated in these numbers.
 */
export const WORKED_EXAMPLE: Scenario = {
  version: 3,
  currency: 'USD',
  rounds: [
    {
      id: 'a',
      label: 'Series A',
      date: '2020-01-01',
      valuationCents: toCents(8_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(2_000_000),
      participation: {
        type: 'equity',
        amountCents: toCents(50_000),
        entryFee: { rule: 'percent', percent: 0.02 },
      },
    },
    {
      id: 'b',
      label: 'Series B',
      date: '2022-01-01',
      valuationCents: toCents(24_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(6_000_000),
    },
    {
      id: 'c',
      label: 'Series C',
      date: '2024-01-01',
      valuationCents: toCents(48_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(12_000_000),
    },
  ],
  fees: {
    carry: { percent: 0.2, basis: 'per_deal' },
  },
  exit: {
    date: '2026-01-01',
    valueCents: toCents(60_000_000),
    totalRaisedCents: toCents(20_000_000),
  },
}

/** A post-money SAFE with a $5M cap and a 20% discount, converting at a priced Seed, then a follow-on at Series A. */
export const SAFE_AT_A_CAP: Scenario = {
  version: 3,
  currency: 'USD',
  rounds: [
    {
      id: 'pre-seed',
      label: 'Pre-seed',
      date: '2023-03-01',
      valuationCents: toCents(5_000_000),
      valuationBasis: 'post',
      raisedCents: toCents(100_000),
      participation: {
        type: 'safe',
        amountCents: toCents(100_000),
        entryFee: { rule: 'greater_of', percent: 0.02, fixedCents: toCents(2_500) },
        discount: 0.2,
      },
    },
    {
      id: 'seed',
      label: 'Seed',
      date: '2024-09-01',
      valuationCents: toCents(8_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(2_000_000),
      newOptionPool: 0.1,
    },
    {
      id: 'a',
      label: 'Series A',
      date: '2026-06-01',
      valuationCents: toCents(30_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(10_000_000),
      participation: {
        type: 'equity',
        amountCents: toCents(45_000),
        entryFee: { rule: 'greater_of', percent: 0.02, fixedCents: toCents(2_500) },
      },
    },
  ],
  fees: {
    carry: { percent: 0.2, basis: 'per_deal' },
  },
  exit: {
    date: '2031-01-01',
    valueCents: toCents(120_000_000),
    totalRaisedCents: toCents(12_100_000),
  },
}

/** A convertible note at 8% simple interest and a 20% discount, entering in euros. */
export const CONVERTIBLE_LOAN: Scenario = {
  version: 3,
  currency: 'EUR',
  rounds: [
    {
      id: 'pre-seed',
      label: 'Pre-seed',
      date: '2023-01-01',
      valuationCents: toCents(5_000_000),
      valuationBasis: 'post',
      raisedCents: toCents(50_000),
      participation: {
        type: 'cla',
        amountCents: toCents(50_000),
        entryFee: { rule: 'percent', percent: 0.02 },
        discount: 0.2,
        interestRate: 0.08,
      },
    },
    {
      id: 'seed',
      label: 'Seed',
      date: '2025-01-01',
      valuationCents: toCents(8_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(2_000_000),
    },
    {
      id: 'a',
      label: 'Series A',
      date: '2027-01-01',
      valuationCents: toCents(24_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(6_000_000),
    },
  ],
  fees: {
    carry: { percent: 0.2, basis: 'per_deal' },
  },
  exit: {
    date: '2032-01-01',
    valueCents: toCents(25_000_000),
    totalRaisedCents: toCents(8_050_000),
  },
}
