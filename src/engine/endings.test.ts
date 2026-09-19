import { describe, expect, it } from 'vitest'
import { endings } from './endings'
import { toCents } from './money'
import { runScenario } from './scenario'
import type { Round, Scenario } from './types'

const NO_FEE = { rule: 'percent' as const, percent: 0 }

/** $50k at $8M pre / $10M post, one later round, 20% carry. */
function deal(entry: Partial<Round> = {}, overrides: Partial<Scenario> = {}): Scenario {
  const scenario: Scenario = {
    version: 3,
    currency: 'USD',
    rounds: [
      {
        id: 'a',
        label: 'Seed',
        date: '2020-01-01',
        valuationCents: toCents(8_000_000),
        valuationBasis: 'pre',
        raisedCents: toCents(2_000_000),
        participation: { type: 'equity', amountCents: toCents(50_000), entryFee: NO_FEE },
        ...entry,
      },
      { id: 'b', label: 'Series A', date: '2022-01-01', valuationCents: toCents(24_000_000), valuationBasis: 'pre', raisedCents: toCents(6_000_000) },
    ],
    fees: { carry: { percent: 0.2, basis: 'per_deal' } },
    exit: { date: '2027-01-01', valueCents: toCents(60_000_000), totalRaisedCents: toCents(8_000_000) },
    ...overrides,
  }
  return scenario
}

const run = (s: Scenario) => endings(s, runScenario(s))

describe('four ways a deal can end', () => {
  const result = run(deal())

  it('prices each ending from the entry valuation and the capital raised', () => {
    expect(result?.entryPostCents).toBe(toCents(10_000_000))
    expect(result?.rows.map((r) => [r.kind, r.valueCents])).toEqual([
      ['fails', 0],
      ['capital', toCents(8_000_000)],
      ['grows10', toCents(100_000_000)],
      ['grows100', toCents(1_000_000_000)],
    ])
  })

  it('returns nothing when the company fails', () => {
    const fails = result?.rows[0]?.outcome
    expect(fails?.exit.highCents).toBe(0)
    expect(fails?.feesHigh.netCents).toBe(0)
    expect(fails?.feesHigh.netMultiple).toBe(0)
  })

  it('pays the cheque back when the company sells for what it raised', () => {
    const capital = result?.rows[1]?.outcome
    expect(capital?.exit.regime).toBe('downside')
    expect(capital?.feesLow.netCents).toBe(toCents(50_000))
  })

  it('gives the angel less than the company’s multiple, after dilution and carry', () => {
    // 0.40% of $1B is $4M gross; carry takes 20% of the $3.95M profit.
    const grows100 = result?.rows[3]?.outcome
    expect(grows100?.exit.highCents).toBe(toCents(4_000_000))
    expect(grows100?.feesHigh.netCents).toBe(toCents(3_210_000))
    expect(grows100?.feesHigh.netMultiple).toBeCloseTo(64.2, 9)
    expect(result?.covers.grows100).toBe(63)
  })

  it('never counts a range by its hopeful end', () => {
    // At 10x ($100M) the exit is clean here: 0.40% of $100M = $400k, net $330k, 6.6x.
    expect(result?.covers.grows10).toBe(5)
  })

  it('measures a SAFE’s growth from its cap', () => {
    const safe = run(
      deal({
        valuationCents: toCents(5_000_000),
        valuationBasis: 'post',
        raisedCents: toCents(50_000),
        participation: { type: 'safe', amountCents: toCents(50_000), entryFee: NO_FEE },
      }),
    )
    expect(safe?.entryPostCents).toBe(toCents(5_000_000))
    expect(safe?.rows[2]?.valueCents).toBe(toCents(50_000_000))
  })

  it('has nothing to show before there is a cheque', () => {
    const blank = deal({ participation: { type: 'equity', amountCents: 0, entryFee: NO_FEE } })
    expect(run(blank)).toBeUndefined()
  })
})
