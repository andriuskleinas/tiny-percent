import { describe, expect, it } from 'vitest'
import { toCents } from './money'
import { runScenario } from './scenario'
import type { Scenario } from './types'

/**
 * End to end, on the deal every worked example in the plan uses: a $50k cheque
 * at $8M pre-money, then Series B and Series C, then a $60M exit.
 */
function deal(overrides: Partial<Scenario> = {}): Scenario {
  return {
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
    // Nothing to hold at entry, so the first round quotes zero. By Series C the
    // stake has already fallen to 0.40%, so holding it costs less than it would
    // have cost someone who had followed on and still held 0.50%.
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

  it('reproduces the fee drag figure from the plan exactly', () => {
    expect(result.feesLow.carryCents).toBe(toCents(28_400))
    expect(result.feesLow.netCents).toBe(toCents(163_600))
    expect(result.feesLow.outlayCents).toBe(toCents(51_000))
    expect(result.feesLow.dragCents).toBe(toCents(29_400))
  })

  it('turns 3.84x gross into 3.21x net', () => {
    expect(result.feesLow.grossMultiple).toBeCloseTo(3.84, 9)
    expect(result.feesLow.netMultiple).toBeCloseTo(163_600 / 51_000, 9)
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
      rounds: deal().rounds.map((r, i) =>
        i === 0 ? r : { ...r, angelAction: { kind: 'pro_rata' as const } },
      ),
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

  it('reaches $300,000 gross, and the plan says so too', () => {
    expect(result.exit.lowCents).toBe(toCents(300_000))
  })

  it('wins on dollars and loses on multiple, which is the whole point', () => {
    const sitOut = runScenario(deal())
    const gainFollowing = result.exit.lowCents - result.totalInvestedCents
    const gainSitting = sitOut.exit.lowCents - sitOut.totalInvestedCents
    expect(gainFollowing).toBeGreaterThan(gainSitting)
    expect(result.feesLow.grossMultiple).toBeLessThan(sitOut.feesLow.grossMultiple)
  })

  it('charges the entry fee on every cheque, not just the first', () => {
    expect(result.feesLow.entryFeeCents).toBe(toCents(2_800))
  })
})

describe('a SAFE that converts at the first round', () => {
  const result = runScenario(
    deal({
      entry: {
        type: 'safe_post',
        amountCents: toCents(100_000),
        date: '2019-01-01',
        capCents: toCents(5_000_000),
      },
    }),
  )

  it('converts at the cap and is then diluted by that round', () => {
    expect(result.rounds[0]?.conversion?.ownershipAtConversion).toBeCloseTo(0.02, 12)
    expect(result.rounds[0]?.ownershipAfter).toBeCloseTo(0.016, 12)
  })

  it('carries the conversion detail on the round it happened in', () => {
    expect(result.rounds[0]?.conversion?.route).toBe('cap')
    expect(result.rounds[1]?.conversion).toBeUndefined()
  })
})

describe('a convertible loan accrues until it converts', () => {
  const result = runScenario(
    deal({
      entry: {
        type: 'cla',
        amountCents: toCents(50_000),
        date: '2018-01-01',
        capCents: toCents(5_000_000),
        discount: 0.2,
        interestRate: 0.08,
        interestMode: 'simple',
      },
    }),
  )

  it('accrues over the years between the cheque and the round', () => {
    // 2018-01-01 to 2020-01-01 is 730 days, exactly two years at actual/365.
    expect(result.rounds[0]?.conversion?.convertingCents).toBe(toCents(58_000))
  })

  it('never counts the interest as money the angel paid', () => {
    expect(result.totalInvestedCents).toBe(toCents(50_000))
  })
})

describe('a bad exit', () => {
  const result = runScenario(
    deal({ exit: { date: '2026-01-01', valueCents: toCents(15_000_000), totalRaisedCents: toCents(20_000_000) } }),
  )

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
  const result = runScenario(
    deal({ exit: { date: '2026-01-01', valueCents: toCents(30_000_000), totalRaisedCents: toCents(20_000_000) } }),
  )

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

describe('a loan the angel chooses not to convert', () => {
  const result = runScenario(
    deal({
      entry: {
        type: 'cla',
        amountCents: toCents(50_000),
        date: '2020-01-01',
        capCents: toCents(5_000_000),
        interestRate: 0.08,
        interestMode: 'simple',
      },
      exit: {
        date: '2026-01-01',
        valueCents: toCents(60_000_000),
        totalRaisedCents: toCents(20_000_000),
        unconvertedLoan: 'repay',
      },
    }),
  )

  it('buys no equity at all', () => {
    expect(result.finalOwnership).toBe(0)
    expect(result.rounds.every((r) => r.conversion === undefined)).toBe(true)
  })

  it('still counts the cheque as capital deployed', () => {
    // The money left the angel's account whether or not it became shares.
    expect(result.totalInvestedCents).toBe(toCents(50_000))
    expect(result.feesLow.deployedCents).toBe(toCents(50_000))
  })

  it('is repaid principal plus interest, ahead of every shareholder', () => {
    // Six years at 8% simple, actual/365 across two leap days.
    expect(result.exit.lowCents).toBeGreaterThan(toCents(74_000))
    expect(result.exit.explanation).toMatch(/repaid ahead of every equity holder/i)
  })

  it('reports a real multiple rather than a meaningless zero', () => {
    expect(result.feesLow.grossMultiple).toBeGreaterThan(1.4)
    expect(result.feesLow.netMultiple).toBeGreaterThan(1.2)
    expect(result.irrLow as number).toBeGreaterThan(0)
  })
})
