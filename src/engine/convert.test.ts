import { describe, expect, it } from 'vitest'
import { accrue, convertAt, isConvertible, maturityOf, yearsBetween } from './convert'
import { toCents } from './money'
import { roundTerms, runScenario } from './scenario'
import type { Instrument, Round, Scenario } from './types'

const NO_FEE = { rule: 'percent' as const, percent: 0 }

function safe(patch: Partial<Instrument> = {}): Instrument {
  return { type: 'safe', amountCents: toCents(100_000), entryFee: NO_FEE, ...patch }
}

function entry(patch: Partial<Round> = {}, cheque: Partial<Instrument> = {}): Round {
  return {
    id: 'safe',
    label: 'Pre-seed',
    date: '2023-01-01',
    valuationCents: toCents(5_000_000),
    valuationBasis: 'post',
    raisedCents: toCents(100_000),
    participation: safe(cheque),
    ...patch,
  }
}

function seed(patch: Partial<Round> = {}): Round {
  return {
    id: 'seed',
    label: 'Seed',
    date: '2025-01-01',
    valuationCents: toCents(8_000_000),
    valuationBasis: 'pre',
    raisedCents: toCents(2_000_000),
    ...patch,
  }
}

function convert(e: Round, s: Round = seed()) {
  return convertAt(e, e.participation as Instrument, s, roundTerms(s))
}

function scenario(rounds: Round[]): Scenario {
  return {
    version: 3,
    currency: 'USD',
    rounds,
    fees: { carry: { percent: 0, basis: 'per_deal' } },
    exit: { date: '2030-01-01', valueCents: toCents(100_000_000), totalRaisedCents: toCents(2_100_000) },
  }
}

describe('which price a SAFE converts at', () => {
  it('uses the cap when the round prices above it', () => {
    const c = convert(entry())
    expect(c.route).toBe('cap')
    expect(c.stake).toBeCloseTo(0.02, 12)
    expect(c.ownership).toBeCloseTo(0.016, 12)
  })

  it('uses the discount when it beats the cap', () => {
    const c = convert(entry({ valuationCents: toCents(10_000_000) }, { discount: 0.2 }), seed({ valuationCents: toCents(6_000_000) }))
    expect(c.route).toBe('discount')
    expect(c.ownership).toBeCloseTo(100_000 / 6_400_000, 12)
  })

  it('uses the round price when the round comes in below the cap and there is no discount', () => {
    const c = convert(entry({ valuationCents: toCents(10_000_000) }), seed({ valuationCents: toCents(6_000_000) }))
    expect(c.route).toBe('round_price')
    expect(c.ownership).toBeCloseTo(0.0125, 12)
  })

  it('gives a tie to the cap', () => {
    // A post-money cap equal to the round's pre-money prices at exactly the round price.
    const c = convert(entry({ valuationCents: toCents(8_000_000) }))
    expect(c.route).toBe('cap')
  })

  it('never blends the cap and the discount', () => {
    const c = convert(entry({}, { discount: 0.2 }))
    expect(c.ownership).toBeCloseTo(Math.max(0.02 * 0.8, 100_000 / 8_000_000), 12)
  })

  it('lets a new pool dilute the cap route but not the price routes', () => {
    const pooled = seed({ newOptionPool: 0.1 })
    expect(convert(entry(), pooled).ownership).toBeCloseTo(0.02 * 0.7, 12)
    const discounted = convert(entry({ valuationCents: toCents(10_000_000) }, { discount: 0.2 }), seed({ valuationCents: toCents(6_000_000), newOptionPool: 0.1 }))
    expect(discounted.route).toBe('discount')
    expect(discounted.ownership).toBeCloseTo(100_000 / 6_400_000, 12)
  })
})

describe('a pre-money cap', () => {
  it('counts every SAFE converting alongside, and says it is an estimate', () => {
    const c = convert(entry({ valuationBasis: 'pre', raisedCents: toCents(500_000) }))
    expect(c.capPostCents).toBe(toCents(5_500_000))
    expect(c.stake).toBeCloseTo(100_000 / 5_500_000, 12)
    expect(c.estimate).toBe(true)
  })

  it('is not an estimate when the cap is post-money', () => {
    expect(convert(entry()).estimate).toBe(false)
  })
})

describe('a convertible note', () => {
  it('accrues simple or compounding interest', () => {
    expect(accrue(toCents(50_000), 0.08, 2)).toBe(toCents(58_000))
    expect(accrue(toCents(50_000), 0.08, 2, 'compound')).toBe(toCents(58_320))
    expect(accrue(toCents(50_000), 0, 2)).toBe(toCents(50_000))
  })

  it('converts principal plus interest to the round’s date', () => {
    const note = entry({}, { type: 'cla', amountCents: toCents(50_000), interestRate: 0.08 })
    const c = convert(note, seed({ date: '2024-12-31' }))
    expect(c.convertingCents).toBe(toCents(58_000))
    expect(c.accruedCents).toBe(toCents(8_000))
  })

  it('ignores an interest rate on a SAFE, which has none', () => {
    expect(convert(entry({}, { interestRate: 0.08 })).accruedCents).toBe(0)
  })

  it('measures years Actual/365 and never negative', () => {
    expect(yearsBetween('2023-01-01', '2024-01-01')).toBe(1)
    expect(yearsBetween('2024-01-01', '2023-01-01')).toBe(0)
  })
})

describe('bad terms are refused in plain words', () => {
  it('refuses a discount of 100% or more', () => {
    expect(() => convert(entry({}, { discount: 1 }))).toThrow(/discount/i)
  })

  it('refuses a conversion that would buy the whole company', () => {
    expect(() => convert(entry({ valuationCents: toCents(50_000) }))).toThrow(/whole company/)
  })
})

describe('a SAFE entry in a whole scenario', () => {
  it('shows the stake at the cap while it waits for a priced round', () => {
    const run = runScenario(scenario([entry()]))
    expect(run.entry).toEqual({ kind: 'pending', estimate: false })
    expect(run.finalOwnership).toBeCloseTo(0.02, 12)
    expect(run.rounds[0]?.conversion).toBeUndefined()
  })

  it('converts in the next round and dilutes from there', () => {
    const run = runScenario(scenario([entry(), seed()]))
    expect(run.entry.kind).toBe('converted')
    expect(run.rounds[1]?.ownershipBefore).toBeCloseTo(0.02, 12)
    expect(run.rounds[1]?.heldBefore).toBeCloseTo(0.02, 12)
    expect(run.rounds[1]?.conversion?.route).toBe('cap')
    expect(run.finalOwnership).toBeCloseTo(0.016, 12)
  })

  it('quotes pro-rata on the converted stake', () => {
    const run = runScenario(scenario([entry({ valuationCents: toCents(10_000_000) }, { discount: 0.2 }), seed({ valuationCents: toCents(6_000_000) })]))
    const held = run.rounds[1]?.heldBefore ?? 0
    expect(run.rounds[1]?.proRataCents).toBe(Math.round(held * toCents(2_000_000)))
  })

  it('counts only the principal as invested, for the multiple and the IRR', () => {
    const note = entry({}, { type: 'cla', amountCents: toCents(50_000), interestRate: 0.08 })
    const run = runScenario(scenario([note, seed()]))
    expect(run.rounds[1]?.conversion?.accruedCents).toBeGreaterThan(0)
    expect(run.totalInvestedCents).toBe(toCents(50_000))
    expect(run.chequesCents).toEqual([toCents(50_000)])
  })

  it('converts in the round after the entry even when a round is dated before it', () => {
    const earlier: Round = { id: 'friends', label: 'Friends', date: '2022-01-01', valuationCents: toCents(2_000_000), valuationBasis: 'post', raisedCents: toCents(200_000) }
    const run = runScenario(scenario([entry(), seed(), earlier]))
    expect(run.entry.kind).toBe('converted')
    expect(run.rounds.find((r) => r.round.id === 'seed')?.conversion?.route).toBe('cap')
    expect(run.finalOwnership).toBeCloseTo(0.016, 12)
  })

  it('treats priced shares exactly as before', () => {
    const shares = entry({}, { type: 'equity', discount: 0.5 })
    const run = runScenario(scenario([shares, seed()]))
    expect(run.entry).toEqual({ kind: 'priced', estimate: false })
    expect(run.rounds[1]?.conversion).toBeUndefined()
    expect(run.finalOwnership).toBeCloseTo(0.016, 12)
  })

  it('knows which instruments convert', () => {
    expect(isConvertible('equity')).toBe(false)
    expect(isConvertible('safe')).toBe(true)
    expect(isConvertible('cla')).toBe(true)
  })
})

describe('a note that reaches its maturity date first', () => {
  // $100k at 8% simple from 2023-01-01, due 2024-01-01: one year, $108,000 owed.
  const note = (patch: Partial<Instrument> = {}): Partial<Instrument> => ({
    type: 'cla',
    interestRate: 0.08,
    maturityDate: '2024-01-01',
    ...patch,
  })

  it('is repaid by default, principal and interest, and holds nothing after', () => {
    const run = runScenario(scenario([entry({}, note())]))
    expect(run.maturity).toEqual({ outcome: 'repay', date: '2024-01-01', accruedCents: toCents(8_000), stake: 0, repaidCents: toCents(108_000) })
    expect(run.entry).toEqual({ kind: 'repaid', estimate: false })
    expect(run.finalOwnership).toBe(0)
    expect(run.exit.lowCents).toBe(0)
    // The repayment is the whole return: 1.08x, and 8% a year over the one year.
    expect(run.feesLow.grossMultiple).toBeCloseTo(1.08, 12)
    expect(run.irrLow).toBeCloseTo(0.08, 9)
    expect(run.totalInvestedCents).toBe(toCents(100_000))
  })

  it('takes carry on the interest, out of the repayment', () => {
    const run = runScenario({ ...scenario([entry({}, note())]), fees: { carry: { percent: 0.2, basis: 'per_deal' } } })
    expect(run.feesLow.carryCents).toBe(toCents(1_600))
    expect(run.feesLow.netCents).toBe(toCents(106_400))
    expect(run.irrLow).toBeCloseTo(0.064, 9)
  })

  it('converts at the cap when told to, and later rounds dilute it', () => {
    const run = runScenario(scenario([entry({}, note({ atMaturity: 'convert' })), seed()]))
    expect(run.maturity?.outcome).toBe('convert')
    expect(run.rounds[1]?.conversion).toBeUndefined()
    expect(run.rounds[1]?.heldBefore).toBeCloseTo(108_000 / 5_000_000, 12)
    expect(run.finalOwnership).toBeCloseTo((108_000 / 5_000_000) * 0.8, 12)
    expect(run.entry).toEqual({ kind: 'converted', estimate: false })
  })

  it('converts at the maturity valuation when one is stated', () => {
    const run = runScenario(scenario([entry({}, note({ atMaturity: 'convert', maturityValuationCents: toCents(4_000_000) }))]))
    expect(run.finalOwnership).toBeCloseTo(108_000 / 4_000_000, 12)
  })

  it('adds everything converting to a pre-money valuation, and calls it an estimate', () => {
    const e = entry({ valuationBasis: 'pre', raisedCents: toCents(400_000) }, note({ atMaturity: 'convert' }))
    const m = maturityOf(e, e.participation as Instrument, undefined, '2030-01-01')
    expect(m).toMatchObject({ outcome: 'convert', estimate: true, valuationPostCents: toCents(5_000_000 + 108_000 + 300_000) })
    expect(runScenario(scenario([e])).entry).toEqual({ kind: 'converted', estimate: true })
  })

  it('stops interest at maturity: converting there buys less than waiting for the round', () => {
    const due = runScenario(scenario([entry({}, note({ atMaturity: 'convert' })), seed()]))
    const extended = runScenario(scenario([entry({}, note({ atMaturity: 'extend' })), seed()]))
    expect(extended.maturity).toBeUndefined()
    expect(extended.rounds[1]?.conversion?.convertingCents).toBe(accrue(toCents(100_000), 0.08, yearsBetween('2023-01-01', '2025-01-01')))
    expect(due.finalOwnership).toBeLessThan(extended.finalOwnership)
  })

  it('converts at a round dated on the due date, which is the financing it waited for', () => {
    const run = runScenario(scenario([entry({}, note()), seed({ date: '2024-01-01' })]))
    expect(run.maturity).toBeUndefined()
    expect(run.rounds[1]?.conversion?.route).toBe('cap')
  })

  it('is still waiting if the exit comes before the due date', () => {
    const s = scenario([entry({}, note({ maturityDate: '2031-01-01' }))])
    const run = runScenario(s)
    expect(run.maturity).toBeUndefined()
    expect(run.entry.kind).toBe('pending')
    expect(run.finalOwnership).toBeCloseTo(0.02, 12)
  })

  it('leaves a repaid note out of the preference stack in a downside exit', () => {
    const s = scenario([entry({}, note()), seed({ participation: { type: 'equity', amountCents: toCents(20_000), entryFee: NO_FEE } })])
    const run = runScenario({ ...s, exit: { ...s.exit, valueCents: toCents(1_000_000), totalRaisedCents: toCents(2_000_000) } })
    expect(run.exit.regime).toBe('downside')
    // Only the $20k follow-on is in the stack: 20k / 2M × 1M.
    expect(run.exit.lowCents).toBe(toCents(10_000))
    expect(run.feesLow.grossMultiple).toBeCloseTo((108_000 + 10_000) / 120_000, 12)
  })

  it('means nothing on a SAFE, which has no maturity', () => {
    const run = runScenario(scenario([entry({}, { maturityDate: '2024-01-01' }), seed()]))
    expect(run.maturity).toBeUndefined()
    expect(run.rounds[1]?.conversion?.route).toBe('cap')
  })

  it('refuses a maturity date on or before the date the money was lent', () => {
    expect(() => runScenario(scenario([entry({}, note({ maturityDate: '2023-01-01' }))]))).toThrow(RangeError)
    expect(() => runScenario(scenario([entry({}, note({ maturityDate: '2022-06-01' }))]))).toThrow(RangeError)
  })
})
