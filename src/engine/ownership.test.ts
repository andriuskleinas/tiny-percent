import { describe, expect, it } from 'vitest'
import { toCents } from './money'
import {
  PoolTooLargeError,
  entryOwnership,
  followOnBreakEven,
  ownAfter,
  postMoney,
  proRata,
  stakeValue,
} from './ownership'
import type { RoundTerms } from './ownership'

/** Every golden case runs off one deal, exactly as written in PLAN.md §9. */
const seed: RoundTerms = { preMoney: toCents(8_000_000), raised: toCents(2_000_000) }
const seriesB: RoundTerms = { preMoney: toCents(24_000_000), raised: toCents(6_000_000) }
const seriesBPooled: RoundTerms = { ...seriesB, newOptionPool: 0.1 }

const ENTRY = toCents(50_000)
/** Ownership is a fraction, so twelve places is far tighter than any real use. */
const PLACES = 12

describe('golden case A — priced equity entry', () => {
  it('buys 0.50% of the post-money', () => {
    expect(entryOwnership(ENTRY, seed)).toBeCloseTo(0.005, PLACES)
  })

  it('derives post-money from pre-money and the raise', () => {
    expect(postMoney(seed)).toBe(toCents(10_000_000))
  })
})

describe('golden case B — sitting out Series B', () => {
  const after = ownAfter(0.005, seriesB)

  it('dilutes 0.50% to 0.40%', () => {
    expect(after).toBeCloseTo(0.004, PLACES)
  })

  it('is worth $120k despite the smaller slice', () => {
    expect(stakeValue(after, postMoney(seriesB))).toBe(toCents(120_000))
  })
})

describe('golden case C — following on pro-rata', () => {
  const cheque = proRata(0.005, seriesB)

  it('costs $30,000', () => {
    expect(cheque).toBe(toCents(30_000))
  })

  it('holds the position at exactly 0.50%', () => {
    expect(ownAfter(0.005, seriesB, cheque)).toBeCloseTo(0.005, PLACES)
  })

  it('is worth $150k', () => {
    expect(stakeValue(ownAfter(0.005, seriesB, cheque), postMoney(seriesB))).toBe(toCents(150_000))
  })
})

describe('golden case D — the same round with a new 10% option pool', () => {
  it('dilutes further, to 0.35%', () => {
    expect(ownAfter(0.005, seriesBPooled)).toBeCloseTo(0.0035, PLACES)
  })

  it('raises the cost of holding your position to $45,000', () => {
    expect(proRata(0.005, seriesBPooled)).toBe(toCents(45_000))
  })

  it('still holds at exactly 0.50% once that cheque is written', () => {
    const cheque = proRata(0.005, seriesBPooled)
    expect(ownAfter(0.005, seriesBPooled, cheque)).toBeCloseTo(0.005, PLACES)
  })

  it('costs 50% more than the naive pro-rata, which ignores the pool', () => {
    expect(proRata(0.005, seriesBPooled) / proRata(0.005, seriesB)).toBeCloseTo(1.5, PLACES)
  })
})

describe('the option pool constraint', () => {
  it('rejects a pool at or above the pre-money fraction, rather than returning NaN', () => {
    // pre/post here is 24/30 = 0.8, so an 80% pool has no solution.
    expect(() => ownAfter(0.005, { ...seriesB, newOptionPool: 0.8 })).toThrow(PoolTooLargeError)
  })

  it('explains itself in terms the user can act on', () => {
    let message = ''
    try {
      ownAfter(0.005, { ...seriesB, newOptionPool: 0.85 })
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('85')
    expect(message).toContain('80')
  })

  it('accepts a pool just under the limit', () => {
    expect(() => ownAfter(0.005, { ...seriesB, newOptionPool: 0.79 })).not.toThrow()
  })
})

describe('follow-on break-even', () => {
  it('is the post-money you paid, which is the whole point', () => {
    expect(followOnBreakEven(seriesB, proRata(0.005, seriesB))).toBe(postMoney(seriesB))
  })

  it('holds for a custom cheque too, not just pro-rata', () => {
    expect(followOnBreakEven(seriesB, toCents(17_500))).toBe(postMoney(seriesB))
  })

  it('does not depend on how much you already own', () => {
    const cheque = toCents(25_000)
    const answers = [0, 0.001, 0.05, 0.5, 0.9].map(() => followOnBreakEven(seriesB, cheque))
    expect(new Set(answers).size).toBe(1)
  })

  it('matches the derivation it was simplified from', () => {
    // E = I / (own_with - own_without). Checked here rather than used in the
    // implementation, because the subtraction loses precision on small cheques.
    for (const ownBefore of [0.001, 0.05, 0.5, 0.9]) {
      const cheque = toCents(25_000)
      const gained = ownAfter(ownBefore, seriesB, cheque) - ownAfter(ownBefore, seriesB)
      const derived = cheque / gained
      const exact = followOnBreakEven(seriesB, cheque) as number
      expect(Math.abs(derived - exact) / exact).toBeLessThan(1e-9)
    }
  })

  it('is undefined for a cheque that buys nothing', () => {
    expect(followOnBreakEven(seriesB, 0)).toBeUndefined()
  })

  it('validates the option pool before quoting a number', () => {
    expect(() => followOnBreakEven({ ...seriesB, newOptionPool: 0.9 }, toCents(1000))).toThrow(
      PoolTooLargeError,
    )
  })
})
