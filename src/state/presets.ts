import { toCents } from '../engine/money'
import type { Scenario } from '../engine/types'

/**
 * The page opens on a real deal rather than an empty form, so the first look
 * shows what the tool does. These are the figures every worked example in
 * PLAN.md uses.
 */
export const WORKED_EXAMPLE: Scenario = {
  version: 1,
  currency: 'USD',
  entry: { type: 'equity', amountCents: toCents(50_000), date: '2020-01-01' },
  rounds: [
    {
      id: 'a',
      label: 'Series A',
      date: '2020-01-01',
      preMoneyCents: toCents(8_000_000),
      raisedCents: toCents(2_000_000),
      angelAction: { kind: 'sit_out' },
    },
    {
      id: 'b',
      label: 'Series B',
      date: '2022-01-01',
      preMoneyCents: toCents(24_000_000),
      raisedCents: toCents(6_000_000),
      angelAction: { kind: 'sit_out' },
    },
    {
      id: 'c',
      label: 'Series C',
      date: '2024-01-01',
      preMoneyCents: toCents(48_000_000),
      raisedCents: toCents(12_000_000),
      angelAction: { kind: 'sit_out' },
    },
  ],
  fees: {
    entry: { rule: 'percent', percent: 0.02, charged: 'on_top' },
    carry: { percent: 0.2, basis: 'per_deal' },
  },
  exit: {
    date: '2026-01-01',
    valueCents: toCents(60_000_000),
    totalRaisedCents: toCents(20_000_000),
  },
}

/** A pre-seed SAFE converting at the first priced round. */
export const SAFE_AT_A_CAP: Scenario = {
  version: 1,
  currency: 'USD',
  entry: {
    type: 'safe_post',
    amountCents: toCents(100_000),
    date: '2023-03-01',
    capCents: toCents(5_000_000),
    discount: 0.2,
  },
  rounds: [
    {
      id: 'seed',
      label: 'Seed',
      date: '2024-09-01',
      preMoneyCents: toCents(8_000_000),
      raisedCents: toCents(2_000_000),
      newOptionPool: 0.1,
      angelAction: { kind: 'sit_out' },
    },
    {
      id: 'a',
      label: 'Series A',
      date: '2026-06-01',
      preMoneyCents: toCents(30_000_000),
      raisedCents: toCents(10_000_000),
      angelAction: { kind: 'pro_rata' },
    },
  ],
  fees: {
    entry: { rule: 'greater_of', percent: 0.02, fixedCents: toCents(2_500), charged: 'on_top' },
    carry: { percent: 0.2, basis: 'per_deal' },
  },
  exit: {
    date: '2031-01-01',
    valueCents: toCents(120_000_000),
    totalRaisedCents: toCents(12_000_000),
  },
}

/** A convertible loan, where accrued interest buys ownership the cheque did not. */
export const CONVERTIBLE_LOAN: Scenario = {
  version: 1,
  currency: 'EUR',
  entry: {
    type: 'cla',
    amountCents: toCents(50_000),
    date: '2023-01-01',
    capCents: toCents(5_000_000),
    discount: 0.2,
    interestRate: 0.08,
    interestMode: 'simple',
  },
  rounds: [
    {
      id: 'seed',
      label: 'Seed',
      date: '2025-01-01',
      preMoneyCents: toCents(8_000_000),
      raisedCents: toCents(2_000_000),
      angelAction: { kind: 'sit_out' },
    },
    {
      id: 'a',
      label: 'Series A',
      date: '2027-01-01',
      preMoneyCents: toCents(24_000_000),
      raisedCents: toCents(6_000_000),
      angelAction: { kind: 'sit_out' },
    },
  ],
  fees: {
    entry: { rule: 'percent', percent: 0.02, charged: 'on_top' },
    carry: { percent: 0.2, basis: 'per_deal' },
  },
  exit: {
    date: '2032-01-01',
    valueCents: toCents(25_000_000),
    totalRaisedCents: toCents(8_000_000),
  },
}

export const PRESETS: ReadonlyArray<readonly [string, Scenario]> = [
  ['Priced round, sitting out', WORKED_EXAMPLE],
  ['SAFE at a cap, then a follow-on', SAFE_AT_A_CAP],
  ['Convertible loan, mediocre exit', CONVERTIBLE_LOAN],
]
