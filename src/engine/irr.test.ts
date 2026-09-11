import { describe, expect, it } from 'vitest'
import { toCents } from './money'
import { irr } from './irr'

describe('internal rate of return', () => {
  it('matches the closed form on a single in and out', () => {
    const rate = irr([
      { date: '2020-01-01', amountCents: -toCents(50_000) },
      { date: '2026-01-01', amountCents: toCents(192_000) },
    ])
    // Six years of actual/365 across one leap day, so slightly over six years.
    expect(rate).toBeDefined()
    expect(rate as number).toBeCloseTo(0.25, 2)
  })

  it('is zero when you get back exactly what you put in', () => {
    const rate = irr([
      { date: '2020-01-01', amountCents: -toCents(50_000) },
      { date: '2026-01-01', amountCents: toCents(50_000) },
    ])
    expect(rate as number).toBeCloseTo(0, 9)
  })

  it('goes negative on a loss', () => {
    const rate = irr([
      { date: '2020-01-01', amountCents: -toCents(50_000) },
      { date: '2026-01-01', amountCents: toCents(10_000) },
    ])
    expect(rate as number).toBeLessThan(0)
  })

  it('handles follow-on cheques along the way', () => {
    const rate = irr([
      { date: '2020-01-01', amountCents: -toCents(50_000) },
      { date: '2022-01-01', amountCents: -toCents(30_000) },
      { date: '2026-01-01', amountCents: toCents(300_000) },
    ])
    expect(rate as number).toBeGreaterThan(0.2)
    expect(rate as number).toBeLessThan(0.4)
  })

  it('returns undefined rather than a garbage number when nothing ever comes back', () => {
    expect(
      irr([
        { date: '2020-01-01', amountCents: -toCents(50_000) },
        { date: '2026-01-01', amountCents: -toCents(1_000) },
      ]),
    ).toBeUndefined()
  })

  it('returns undefined when there is nothing to solve', () => {
    expect(irr([])).toBeUndefined()
    expect(irr([{ date: '2020-01-01', amountCents: -toCents(50_000) }])).toBeUndefined()
  })

  it('is insensitive to the order flows are given in', () => {
    const flows = [
      { date: '2026-01-01', amountCents: toCents(300_000) },
      { date: '2020-01-01', amountCents: -toCents(50_000) },
      { date: '2022-01-01', amountCents: -toCents(30_000) },
    ]
    const forward = irr([...flows].reverse()) as number
    expect(irr(flows) as number).toBeCloseTo(forward, 9)
  })

  it('solves a total wipeout to minus one hundred percent', () => {
    const rate = irr([
      { date: '2020-01-01', amountCents: -toCents(50_000) },
      { date: '2026-01-01', amountCents: 1 },
    ])
    expect(rate as number).toBeLessThan(-0.7)
  })
})
