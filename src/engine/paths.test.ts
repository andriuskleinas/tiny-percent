import { describe, expect, it } from 'vitest'
import { toCents } from './money'
import { strategyPaths } from './paths'
import { runScenario } from './scenario'
import type { Round, Scenario } from './types'

/**
 * Three answers to "should I keep writing cheques?", always side by side: sit
 * out every later round, do what you entered, or pay pro-rata every time. On
 * the plan's $50k deal the two extremes are golden cases B/C and viz 3.
 */
const NO_FEE = { rule: 'percent' as const, percent: 0 }
const ENTRY_FEE = { rule: 'percent' as const, percent: 0.02 }

function deal(overrides: Partial<Scenario> = {}): Scenario {
  const rounds: Round[] = [
    {
      id: 'a',
      label: 'Series A',
      date: '2020-01-01',
      valuationCents: toCents(8_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(2_000_000),
      participation: { type: 'equity', amountCents: toCents(50_000), entryFee: NO_FEE },
    },
    {
      id: 'b',
      label: 'Series B',
      date: '2022-01-01',
      valuationCents: toCents(24_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(6_000_000),
      participation: { type: 'equity', amountCents: toCents(10_000), entryFee: NO_FEE },
    },
    {
      id: 'c',
      label: 'Series C',
      date: '2024-01-01',
      valuationCents: toCents(48_000_000),
      valuationBasis: 'pre',
      raisedCents: toCents(12_000_000),
    },
  ]
  return {
    version: 2,
    currency: 'USD',
    rounds,
    fees: { carry: { percent: 0.2, basis: 'per_deal' } },
    exit: { date: '2026-01-01', valueCents: toCents(60_000_000), totalRaisedCents: toCents(20_000_000) },
    ...overrides,
  }
}

describe('the three paths through one deal', () => {
  const paths = strategyPaths(deal())

  it('sits out every round after the entry', () => {
    expect(paths.sitOut.points.map((p) => p.ownership)).toEqual([0.005, 0.004, 0.0032].map((o) => expect.closeTo(o, 12)))
    expect(paths.sitOut.run.totalInvestedCents).toBe(toCents(50_000))
    expect(paths.sitOut.run.exit.lowCents).toBe(toCents(192_000))
  })

  it('pays pro-rata every time and holds 0.50%', () => {
    expect(paths.proRata.points.map((p) => p.chequeCents)).toEqual([50_000, 30_000, 60_000].map(toCents))
    for (const point of paths.proRata.points) expect(point.ownership).toBeCloseTo(0.005, 12)
    expect(paths.proRata.run.totalInvestedCents).toBe(toCents(140_000))
    expect(paths.proRata.run.exit.lowCents).toBe(toCents(300_000))
  })

  it('keeps your path exactly as entered', () => {
    expect(paths.yours.scenario).toEqual(deal())
    expect(paths.yours.run).toEqual(runScenario(deal()))
    expect(paths.yours.points.map((p) => p.chequeCents)).toEqual([50_000, 10_000, 0].map(toCents))
  })

  it('lays out each round with its valuation, cheque, running total and paper value', () => {
    expect(paths.proRata.points).toEqual([
      { roundId: 'a', label: 'Series A', date: '2020-01-01', postMoneyCents: toCents(10_000_000), ownership: expect.closeTo(0.005, 12), chequeCents: toCents(50_000), cumulativeInvestedCents: toCents(50_000), stakeValueCents: toCents(50_000) },
      { roundId: 'b', label: 'Series B', date: '2022-01-01', postMoneyCents: toCents(30_000_000), ownership: expect.closeTo(0.005, 12), chequeCents: toCents(30_000), cumulativeInvestedCents: toCents(80_000), stakeValueCents: toCents(150_000) },
      { roundId: 'c', label: 'Series C', date: '2024-01-01', postMoneyCents: toCents(60_000_000), ownership: expect.closeTo(0.005, 12), chequeCents: toCents(60_000), cumulativeInvestedCents: toCents(140_000), stakeValueCents: toCents(300_000) },
    ])
  })

  it('never changes the rounds, the fees or the exit, only the cheques', () => {
    for (const path of [paths.sitOut, paths.proRata]) {
      expect(path.scenario.fees).toEqual(deal().fees)
      expect(path.scenario.exit).toEqual(deal().exit)
      const withoutCheques = (rounds: Round[]) => rounds.map((r) => ({ ...r, participation: undefined }))
      expect(withoutCheques(path.scenario.rounds)).toEqual(withoutCheques(deal().rounds))
    }
  })
})

describe('pro-rata with a new option pool', () => {
  it('funds your share of the pool too, so the position still holds', () => {
    const rounds = deal().rounds.map((r) => (r.id === 'b' ? { ...r, newOptionPool: 0.1 } : r))
    const paths = strategyPaths(deal({ rounds }))
    expect(paths.proRata.points[1]?.chequeCents).toBe(toCents(45_000))
    for (const point of paths.proRata.points) expect(point.ownership).toBeCloseTo(0.005, 9)
  })
})

describe('the fees a synthetic cheque pays', () => {
  it('uses the round’s own cheque terms when there are some, the entry’s otherwise', () => {
    const rounds = deal().rounds.map((r, i) =>
      i === 0 && r.participation ? { ...r, participation: { ...r.participation, type: 'safe' as const, entryFee: ENTRY_FEE } } : r,
    )
    const paths = strategyPaths(deal({ rounds }))
    const [, b, c] = paths.proRata.scenario.rounds
    expect(b?.participation).toEqual({ type: 'equity', amountCents: toCents(30_000), entryFee: NO_FEE })
    expect(c?.participation).toEqual({ type: 'safe', amountCents: toCents(60_000), entryFee: ENTRY_FEE })
  })
})

describe('rounds before the entry', () => {
  it('get no pro-rata cheque, because there is nothing yet to hold', () => {
    const earlier: Round = { id: 'pre', label: 'Pre-seed', date: '2019-01-01', valuationCents: toCents(3_000_000), valuationBasis: 'post', raisedCents: toCents(500_000) }
    const paths = strategyPaths(deal({ rounds: [...deal().rounds, earlier] }))
    const pre = paths.proRata.points.find((p) => p.roundId === 'pre')
    expect(pre?.chequeCents).toBe(0)
    expect(paths.proRata.scenario.rounds.find((r) => r.id === 'pre')?.participation).toBeUndefined()
  })
})

describe('when you already follow on pro-rata', () => {
  it('your path and the pro-rata path are the same', () => {
    const rounds = deal().rounds.map((r) =>
      r.id === 'b' ? { ...r, participation: { type: 'equity' as const, amountCents: toCents(30_000), entryFee: NO_FEE } }
      : r.id === 'c' ? { ...r, participation: { type: 'equity' as const, amountCents: toCents(60_000), entryFee: NO_FEE } }
      : r,
    )
    const paths = strategyPaths(deal({ rounds }))
    expect(paths.yours.points).toEqual(paths.proRata.points)
    expect(paths.yours.run.feesLow).toEqual(paths.proRata.run.feesLow)
  })
})
