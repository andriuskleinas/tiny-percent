import { describe, expect, it } from 'vitest'
import { toCents } from './money'
import { stakeValue } from './ownership'
import type { RoundTerms } from './ownership'
import {
  accrue,
  accruesInterest,
  convert,
  defaultCapBasis,
  instrumentPath,
  maturityOutcome,
  yearsBetween,
} from './instrument'
import type { ConvertibleInput } from './instrument'
import type { InstrumentType } from './types'

/** Every convertible golden case converts into this round: $2M at $8M pre. */
const round: RoundTerms = { preMoney: toCents(8_000_000), raised: toCents(2_000_000) }
const PLACES = 12

describe('golden case E — $100k post-money SAFE at a $5M cap', () => {
  const safe: ConvertibleInput = {
    type: 'safe_post',
    amountCents: toCents(100_000),
    capCents: toCents(5_000_000),
  }
  const result = convert(safe, round)

  it('locks 2.00% before the new money lands', () => {
    expect(result.ownershipAtConversion).toBeCloseTo(0.02, PLACES)
  })

  it('is diluted to 1.60% by the round it converts in', () => {
    expect(result.ownership).toBeCloseTo(0.016, PLACES)
  })

  it('converts exactly what was paid, because a SAFE does not accrue', () => {
    expect(result.convertingCents).toBe(toCents(100_000))
    expect(result.accruedCents).toBe(0)
  })

  it('takes the cap route', () => {
    expect(result.route).toBe('cap')
    expect(result.effectiveValuationCents).toBe(toCents(6_250_000))
  })
})

describe('golden case F — $50k convertible loan, 8% simple over two years', () => {
  const cla: ConvertibleInput = {
    type: 'cla',
    amountCents: toCents(50_000),
    capCents: toCents(5_000_000),
    discount: 0.2,
    interestRate: 0.08,
    interestMode: 'simple',
    years: 2,
  }
  const result = convert(cla, round)

  it('converts $58,000 after interest', () => {
    expect(result.convertingCents).toBe(toCents(58_000))
    expect(result.accruedCents).toBe(toCents(8_000))
  })

  it('converts at a $6.25M effective valuation, the cap beating the discount', () => {
    expect(result.effectiveValuationCents).toBe(toCents(6_250_000))
    expect(result.route).toBe('cap')
  })

  it('buys 0.928%', () => {
    expect(result.ownership).toBeCloseTo(0.00928, PLACES)
  })

  it('never counts the accrued interest as money you paid', () => {
    expect(result.investedCents).toBe(toCents(50_000))
  })
})

describe('golden case G — the same loan without interest', () => {
  const base: ConvertibleInput = {
    type: 'cla',
    amountCents: toCents(50_000),
    capCents: toCents(5_000_000),
    discount: 0.2,
  }
  const plain = convert(base, round)
  const accruing = convert({ ...base, interestRate: 0.08, interestMode: 'simple', years: 2 }, round)

  it('buys 0.80%', () => {
    expect(plain.ownership).toBeCloseTo(0.008, PLACES)
  })

  it('shows accrual is worth 16% more ownership for the same cheque', () => {
    expect(accruing.ownership / plain.ownership - 1).toBeCloseTo(0.16, PLACES)
    expect(accruing.investedCents).toBe(plain.investedCents)
  })
})

describe('golden case H — case F at a $60M exit', () => {
  const result = convert(
    {
      type: 'cla',
      amountCents: toCents(50_000),
      capCents: toCents(5_000_000),
      discount: 0.2,
      interestRate: 0.08,
      interestMode: 'simple',
      years: 2,
    },
    round,
  )

  it('is worth $556,800 on 0.928%', () => {
    expect(stakeValue(result.ownership, toCents(60_000_000))).toBe(toCents(556_800))
  })

  it('returns 11.14x on the $50,000 actually paid, not 9.60x on the $58,000 converted', () => {
    const proceeds = stakeValue(result.ownership, toCents(60_000_000))
    expect(proceeds / result.investedCents).toBeCloseTo(11.136, 6)
    expect(proceeds / result.convertingCents).toBeCloseTo(9.6, 6)
  })
})

describe('cap and discount are alternatives, never both', () => {
  const amount = toCents(100_000)

  it('takes the discount when the cap is generous', () => {
    const result = convert(
      { type: 'safe_post', amountCents: amount, capCents: toCents(20_000_000), discount: 0.2 },
      round,
    )
    expect(result.route).toBe('discount')
    expect(result.effectiveValuationCents).toBe(toCents(8_000_000))
  })

  it('takes the round price when there is neither', () => {
    const result = convert({ type: 'safe_post', amountCents: amount }, round)
    expect(result.route).toBe('round_price')
    expect(result.effectiveValuationCents).toBe(toCents(10_000_000))
    expect(result.ownership).toBeCloseTo(0.01, PLACES)
  })

  it('never lands between the two routes', () => {
    for (const cap of [3, 5, 6.25, 8, 12, 20]) {
      const result = convert(
        {
          type: 'safe_post',
          amountCents: amount,
          capCents: toCents(cap * 1_000_000),
          discount: 0.2,
        },
        round,
      )
      const capRoute = toCents(cap * 1_000_000) * 1.25
      const discountRoute = toCents(8_000_000)
      expect([capRoute, discountRoute]).toContain(result.effectiveValuationCents)
      expect(result.effectiveValuationCents).toBe(Math.min(capRoute, discountRoute))
    }
  })
})

describe('pre-money caps dilute you with everything else converting', () => {
  const base = {
    type: 'safe_pre' as const,
    amountCents: toCents(100_000),
    capCents: toCents(5_000_000),
  }

  it('is worse than the same number as a post-money cap', () => {
    const pre = convert(base, round)
    const post = convert({ ...base, type: 'safe_post' }, round)
    expect(pre.ownershipAtConversion).toBeCloseTo(100_000 / 5_100_000, PLACES)
    expect(pre.ownership).toBeLessThan(post.ownership)
  })

  it('is diluted further by other instruments converting alongside', () => {
    const result = convert({ ...base, otherConvertingCents: toCents(400_000) }, round)
    expect(result.ownershipAtConversion).toBeCloseTo(100_000 / 5_500_000, PLACES)
    expect(result.ownership).toBeCloseTo((100_000 / 5_500_000) * 0.8, PLACES)
  })

  it('is flagged an estimate, because you cannot see the other instruments', () => {
    expect(convert(base, round).estimate).toBe(true)
    expect(convert({ ...base, type: 'safe_post' }, round).estimate).toBe(false)
  })
})

describe('all six types resolve to a path', () => {
  const types: InstrumentType[] = [
    'equity',
    'safe_post',
    'safe_pre',
    'cla',
    'asa',
    'kiss_equity',
    'kiss_debt',
  ]

  it.each(types)('%s has a path, a cap basis and an accrual rule', (type) => {
    expect(['priced', 'convertible', 'accruing']).toContain(instrumentPath(type))
    expect(['pre', 'post']).toContain(defaultCapBasis(type))
    expect(typeof accruesInterest(type)).toBe('boolean')
  })

  it('only loans accrue', () => {
    expect(types.filter(accruesInterest)).toEqual(['cla', 'kiss_debt'])
  })

  it('treats ASA and KISS equity as aliases of a post-money SAFE', () => {
    const terms = { amountCents: toCents(100_000), capCents: toCents(5_000_000) }
    const safe = convert({ ...terms, type: 'safe_post' }, round)
    for (const type of ['asa', 'kiss_equity'] as const) {
      expect(convert({ ...terms, type }, round).ownership).toBeCloseTo(safe.ownership, PLACES)
    }
  })

  it('prices equity straight off the post-money, ignoring cap and discount', () => {
    const result = convert(
      { type: 'equity', amountCents: toCents(50_000), capCents: toCents(1), discount: 0.9 },
      round,
    )
    expect(result.route).toBe('round_price')
    expect(result.ownership).toBeCloseTo(0.005, PLACES)
  })
})

describe('interest accrual', () => {
  it('accrues simple interest on the principal only', () => {
    expect(accrue(toCents(50_000), 0.08, 2, 'simple')).toBe(toCents(58_000))
  })

  it('compounds annually when asked', () => {
    expect(accrue(toCents(50_000), 0.08, 2, 'compound')).toBe(toCents(58_320))
  })

  it('is a no-op with no rate or no time', () => {
    expect(accrue(toCents(50_000), 0, 5, 'simple')).toBe(toCents(50_000))
    expect(accrue(toCents(50_000), 0.08, 0, 'compound')).toBe(toCents(50_000))
  })
})

describe('year counting uses actual days over 365', () => {
  it('counts two ordinary years as exactly two', () => {
    expect(yearsBetween('2025-01-01', '2027-01-01')).toBeCloseTo(2, PLACES)
  })

  it('counts a leap day, so a span containing one runs slightly long', () => {
    expect(yearsBetween('2024-01-01', '2026-01-01')).toBeCloseTo(731 / 365, PLACES)
  })

  it('refuses to run backwards', () => {
    expect(() => yearsBetween('2027-01-01', '2025-01-01')).toThrow(/before/i)
  })
})

describe('a loan reaching maturity without a round', () => {
  const loan: ConvertibleInput = {
    type: 'cla',
    amountCents: toCents(50_000),
    capCents: toCents(5_000_000),
    interestRate: 0.08,
    interestMode: 'simple',
    years: 3,
  }

  it('repaying is a cash claim for principal plus interest', () => {
    const outcome = maturityOutcome(loan, 'repay')
    expect(outcome.kind).toBe('repay')
    expect(outcome.owedCents).toBe(toCents(62_000))
  })

  it('extending keeps it outstanding at the same amount owed', () => {
    expect(maturityOutcome(loan, 'extend')).toEqual({
      kind: 'extend',
      owedCents: toCents(62_000),
    })
  })

  it('converting hands the accrued amount on to the conversion', () => {
    expect(maturityOutcome(loan, 'convert').owedCents).toBe(toCents(62_000))
  })

  it('does not apply to instruments that never mature', () => {
    expect(() => maturityOutcome({ ...loan, type: 'safe_post' }, 'repay')).toThrow(/maturity/i)
  })
})
