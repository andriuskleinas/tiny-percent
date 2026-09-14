import { toCents } from '../engine/money'
import type { Scenario } from '../engine/types'

/**
 * What a fresh visit sees: just the entry, with realistic numbers already
 * filled in so the fields make sense, but no follow-on rounds — those are for
 * the user to add themselves with "Add follow-on round".
 */
export const STARTING_POINT: Scenario = {
  version: 2,
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
  ],
  fees: {
    carry: { percent: 0.2, basis: 'per_deal' },
  },
  exit: {
    date: '2026-01-01',
    valueCents: toCents(30_000_000),
    totalRaisedCents: toCents(2_000_000),
  },
}

/**
 * A fuller worked example, three rounds deep — used by the test suite to
 * exercise dilution across rounds. Not what a fresh visit loads.
 */
export const WORKED_EXAMPLE: Scenario = {
  version: 2,
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

/** A SAFE at pre-seed, then a priced Seed and a follow-on at Series A. */
export const SAFE_AT_A_CAP: Scenario = {
  version: 2,
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

/** A convertible loan, entering in euros. */
export const CONVERTIBLE_LOAN: Scenario = {
  version: 2,
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
