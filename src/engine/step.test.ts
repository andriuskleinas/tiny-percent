import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { toCents } from './money'
import { previousPostMoney, roundFromStep, stepFromRound } from './step'
import type { Round, Scenario } from './types'

/**
 * A round described the way people talk about it: the valuation grew three
 * times and the company sold a fifth. Stored as post-money and amount raised,
 * so the sliders and the exact fields always edit the same two numbers.
 */

interface Fixture {
  N: {
    prevPostCents: number
    steps: Array<{ growth: number; sold: number; pool: number; postMoneyCents: number; raisedCents: number; stakeFactor: number }>
  }
}

const { N } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../tools/golden-cases.json', import.meta.url)), 'utf8'),
) as Fixture

const round = (patch: Partial<Round>): Round => ({
  id: 'r',
  label: 'Series A',
  date: '2027-01-01',
  valuationCents: 0,
  valuationBasis: 'post',
  raisedCents: 0,
  ...patch,
})

describe('a step agrees with the Python oracle (case N)', () => {
  it.each(N.steps)('grows ×$growth selling $sold with a $pool pool', (step) => {
    const terms = roundFromStep(N.prevPostCents, step.growth, step.sold)
    expect(terms).toEqual({ valuationCents: step.postMoneyCents, raisedCents: step.raisedCents, valuationBasis: 'post' })
    const read = stepFromRound(N.prevPostCents, round({ ...terms, newOptionPool: step.pool || undefined }))
    expect(read?.growth).toBeCloseTo(step.growth, 12)
    expect(read?.sold).toBeCloseTo(step.sold, 12)
    expect(read?.pool).toBe(step.pool)
    expect(read?.stakeFactor).toBeCloseTo(step.stakeFactor, 12)
  })

  it('shows an up round that still makes an existing stake worth less', () => {
    const treadmill = stepFromRound(toCents(15_000_000), round(roundFromStep(toCents(15_000_000), 1.25, 0.25)))
    expect(treadmill?.growth).toBeGreaterThan(1)
    expect(treadmill?.stakeFactor).toBeCloseTo(0.9375, 12)
  })
})

describe('reading a round entered as pre-money', () => {
  it('derives the same step as the post-money form', () => {
    const read = stepFromRound(toCents(5_000_000), round({ valuationCents: toCents(12_000_000), valuationBasis: 'pre', raisedCents: toCents(3_000_000) }))
    expect(read?.growth).toBeCloseTo(3, 12)
    expect(read?.sold).toBeCloseTo(0.2, 12)
    expect(read?.stakeFactor).toBeCloseTo(2.4, 12)
  })
})

describe('steps round-trip through whole cents', () => {
  it('returns the growth and share sold it was given, for any sensible round', () => {
    let seed = 7
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < 2000; i++) {
      const prev = Math.round(10 ** (7 + random() * 5))
      const growth = 0.2 + random() * 15
      const sold = random() * 0.9
      const read = stepFromRound(prev, round(roundFromStep(prev, growth, sold)))
      expect(read).toBeDefined()
      expect(Math.abs((read?.growth ?? 0) - growth) / growth).toBeLessThan(1e-6)
      expect(Math.abs((read?.sold ?? 0) - sold)).toBeLessThan(1e-6)
    }
  })
})

describe('inputs with no answer', () => {
  it('refuses a growth that is not positive or a share sold outside [0, 1)', () => {
    expect(() => roundFromStep(toCents(5_000_000), 0, 0.2)).toThrow(RangeError)
    expect(() => roundFromStep(toCents(5_000_000), 2, 1)).toThrow(RangeError)
    expect(() => roundFromStep(toCents(5_000_000), 2, -0.1)).toThrow(RangeError)
    expect(() => roundFromStep(0, 2, 0.2)).toThrow(RangeError)
  })

  it('has no step to read without a previous valuation or a priced round', () => {
    expect(stepFromRound(0, round({ valuationCents: toCents(1_000_000), raisedCents: 1 }))).toBeUndefined()
    expect(stepFromRound(toCents(5_000_000), round({}))).toBeUndefined()
    expect(stepFromRound(toCents(5_000_000), round({ valuationCents: 100, raisedCents: 200 }))).toBeUndefined()
  })
})

describe('the round before', () => {
  const scenario = {
    rounds: [
      round({ id: 'seed', date: '2026-01-01', valuationCents: toCents(4_000_000), valuationBasis: 'pre', raisedCents: toCents(1_000_000) }),
      round({ id: 'b', date: '2029-01-01', valuationCents: toCents(40_000_000), raisedCents: toCents(8_000_000) }),
      round({ id: 'a', date: '2027-01-01', valuationCents: toCents(15_000_000), raisedCents: toCents(3_000_000) }),
    ],
  } as Pick<Scenario, 'rounds'>

  it('is found by date, not by position', () => {
    expect(previousPostMoney(scenario, 'b')).toBe(toCents(15_000_000))
    expect(previousPostMoney(scenario, 'a')).toBe(toCents(5_000_000))
  })

  it('does not exist for the earliest round or an unknown id', () => {
    expect(previousPostMoney(scenario, 'seed')).toBeUndefined()
    expect(previousPostMoney(scenario, 'nope')).toBeUndefined()
  })

  it('does not exist when that round cannot be priced', () => {
    const broken = { rounds: [round({ id: 'x', date: '2026-01-01', valuationCents: 1, raisedCents: 5 }), round({ id: 'y', date: '2027-01-01' })] }
    expect(previousPostMoney(broken, 'y')).toBeUndefined()
  })
})
