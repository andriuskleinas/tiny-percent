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
