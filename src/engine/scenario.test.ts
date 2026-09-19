import { describe, expect, it } from 'vitest'
import { toCents } from './money'
import { outcomesAt, runScenario } from './scenario'
import type { Round, Scenario } from './types'

/**
 * End to end, on the deal every worked example in the plan uses: a $50k cheque
 * at $8M pre-money, then Series B and Series C, then a $60M exit.
 */
const NO_FEE = { rule: 'percent' as const, percent: 0 }

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
    version: 3,
    currency: 'USD',
    rounds,
    fees: { carry: { percent: 0.2, basis: 'per_deal' } },
    exit: { date: '2026-01-01', valueCents: toCents(60_000_000), totalRaisedCents: toCents(20_000_000) },
    ...overrides,
  }
}

describe('sitting out every round', () => {
  const result = runScenario(deal())

  it('walks the ownership down 0.50, 0.40, 0.32', () => {
    expect(result.rounds.map((r) => Number(r.ownershipAfter.toFixed(6)))).toEqual([
      0.005, 0.004, 0.0032,
    ])
  })

  it('grows the stake even as the slice shrinks', () => {
    expect(result.rounds.map((r) => r.stakeValueCents)).toEqual([
      toCents(50_000),
      toCents(120_000),
      toCents(192_000),
    ])
  })

  it('quotes what each round would have cost to hold the prior position', () => {
    expect(result.rounds.map((r) => r.proRataCents)).toEqual([0, toCents(30_000), toCents(48_000)])
  })

  it('records the entry cheque against the round it was written into', () => {
    expect(result.rounds.map((r) => r.investedCents)).toEqual([toCents(50_000), 0, 0])
  })

  it('deploys only the entry cheque', () => {
    expect(result.totalInvestedCents).toBe(toCents(50_000))
  })

  it('exits cleanly at $192,000 gross', () => {
    expect(result.exit.regime).toBe('clean')
    expect(result.exit.lowCents).toBe(toCents(192_000))
  })

  it('takes carry on the profit above what was deployed', () => {
    expect(result.feesLow.carryCents).toBe(toCents(28_400))
    expect(result.feesLow.netCents).toBe(toCents(163_600))
    expect(result.feesLow.outlayCents).toBe(toCents(50_000))
  })

  it('turns 3.84x gross into 3.27x net', () => {
    expect(result.feesLow.grossMultiple).toBeCloseTo(3.84, 9)
    expect(result.feesLow.netMultiple).toBeCloseTo(163_600 / 50_000, 9)
  })

  it('reports a rate of return over the six years held', () => {
    expect(result.irrLow).toBeDefined()
    expect(result.irrLow as number).toBeGreaterThan(0.2)
    expect(result.irrLow as number).toBeLessThan(0.25)
  })
})

describe('following on at every round', () => {
  const result = runScenario(
    deal({
      rounds: [
        deal().rounds[0] as Round,
        { ...(deal().rounds[1] as Round), participation: { type: 'equity', amountCents: toCents(30_000), entryFee: NO_FEE } },
        { ...(deal().rounds[2] as Round), participation: { type: 'equity', amountCents: toCents(60_000), entryFee: NO_FEE } },
      ],
    }),
  )

  it('holds the position at 0.50% throughout', () => {
    for (const round of result.rounds) {
      expect(round.ownershipAfter).toBeCloseTo(0.005, 12)
    }
  })

  it('deploys $140,000 to do it', () => {
    expect(result.totalInvestedCents).toBe(toCents(140_000))
  })

  it('reaches $300,000 gross', () => {
    expect(result.exit.lowCents).toBe(toCents(300_000))
  })

  it('wins on dollars and loses on multiple, which is the whole point', () => {
    const sitOut = runScenario(deal())
    const gainFollowing = result.exit.lowCents - result.totalInvestedCents
    const gainSitting = sitOut.exit.lowCents - sitOut.totalInvestedCents
    expect(gainFollowing).toBeGreaterThan(gainSitting)
    expect(result.feesLow.grossMultiple).toBeLessThan(sitOut.feesLow.grossMultiple)
  })
})

describe('the entry fee is charged per cheque, not just the first', () => {
  it('a follow-on pays it again', () => {
    const fee = { rule: 'percent' as const, percent: 0.02 }
    const result = runScenario(
      deal({
        rounds: [
          { ...(deal().rounds[0] as Round), participation: { type: 'equity', amountCents: toCents(50_000), entryFee: fee } },
          { ...(deal().rounds[1] as Round), participation: { type: 'equity', amountCents: toCents(30_000), entryFee: fee } },
          { ...(deal().rounds[2] as Round), participation: { type: 'equity', amountCents: toCents(60_000), entryFee: fee } },
        ],
      }),
    )
    expect(result.feesLow.entryFeeCents).toBe(toCents(2_800))
  })
})

describe('a bad exit', () => {
  const result = runScenario(deal({ exit: { ...deal().exit, valueCents: toCents(15_000_000) } }))

  it('falls into the downside regime and says so', () => {
    expect(result.exit.regime).toBe('downside')
    expect(result.exit.lowCents).toBe(toCents(37_500))
  })

  it('takes no carry on a loss', () => {
    expect(result.feesLow.carryCents).toBe(0)
  })

  it('still reports a rate of return, a negative one', () => {
    expect(result.irrLow as number).toBeLessThan(0)
  })
})

describe('an exit inside the uncertain band', () => {
  const result = runScenario(deal({ exit: { ...deal().exit, valueCents: toCents(30_000_000) } }))

  it('reports both bounds and prices fees against each', () => {
    expect(result.exit.uncertain).toBe(true)
    expect(result.feesLow.netCents).toBeLessThan(result.feesHigh.netCents)
    expect(result.irrLow as number).toBeLessThan(result.irrHigh as number)
  })
})

describe('rounds are read in date order regardless of how they arrive', () => {
  it('gives the same answer for a shuffled list', () => {
    const ordered = runScenario(deal())
    const shuffled = runScenario(deal({ rounds: [...deal().rounds].reverse() }))
    expect(shuffled.finalOwnership).toBeCloseTo(ordered.finalOwnership, 12)
    expect(shuffled.rounds.map((r) => r.round.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('the scenario’s currency reaches the engine’s own wording', () => {
  it('explains a euro exit in euros', () => {
    const { explanation } = runScenario(deal({ currency: 'EUR' })).exit
    expect(explanation).toContain('€20,000,000')
    expect(explanation).not.toContain('$')
  })
})

describe('a blank scenario, before anything is typed', () => {
  const blank = deal({
    rounds: [{ ...(deal().rounds[0] as Round), valuationCents: 0, raisedCents: 0, participation: { type: 'equity', amountCents: 0, entryFee: NO_FEE } }],
    exit: { ...deal().exit, totalRaisedCents: 0 },
  })

  it('runs to zeros rather than dividing by zero', () => {
    const result = runScenario(blank)
    expect(result.finalOwnership).toBe(0)
    expect(result.totalInvestedCents).toBe(0)
    expect(result.rounds[0]?.stakeValueCents).toBe(0)
    expect(result.exit.lowCents).toBe(0)
    expect(result.irrLow).toBeUndefined()
  })

  it('still refuses a cheque into a company with no valuation', () => {
    const cheque = { ...blank, rounds: [{ ...(blank.rounds[0] as Round), participation: { type: 'equity' as const, amountCents: toCents(5_000), entryFee: NO_FEE } }] }
    expect(() => runScenario(cheque)).toThrow(/valuation/)
  })
})

describe('a post-money valuation smaller than the raise', () => {
  it('is refused, because it would mean a negative pre-money', () => {
    const round = { ...(deal().rounds[0] as Round), valuationBasis: 'post' as const, valuationCents: toCents(1_000_000) }
    expect(() => runScenario(deal({ rounds: [round] }))).toThrow(/smaller than the .* raised/)
  })
})

describe('outcomes at several exit values at once', () => {
  it('matches running the scenario at each value on its own', () => {
    const values = [toCents(15_000_000), toCents(30_000_000), toCents(60_000_000)]
    const rows = outcomesAt(deal(), values)
    rows.forEach((row, i) => {
      const alone = runScenario(deal({ exit: { ...deal().exit, valueCents: values[i] as number } }))
      expect(row.valueCents).toBe(values[i])
      expect(row.exit).toEqual(alone.exit)
      expect(row.feesLow).toEqual(alone.feesLow)
      expect(row.feesHigh).toEqual(alone.feesHigh)
    })
  })
})
