import { describe, expect, it } from 'vitest'
import { toCents } from './money'
import { exitProceeds } from './exit'
import type { ExitInput } from './exit'

/** The running deal: $20M raised across three rounds, angel on 0.32%. */
const base: ExitInput = {
  valueCents: toCents(60_000_000),
  totalRaisedCents: toCents(20_000_000),
  ownership: 0.0032,
  investedCents: toCents(50_000),
}

describe('golden case I — a clean exit at $60M', () => {
  const result = exitProceeds(base)

  it('pays your ownership share, $192,000', () => {
    expect(result.lowCents).toBe(toCents(192_000))
    expect(result.highCents).toBe(toCents(192_000))
  })

  it('is labelled clean, with nothing uncertain about it', () => {
    expect(result.regime).toBe('clean')
    expect(result.uncertain).toBe(false)
  })
})

describe('golden case K — a $15M exit against $20M raised', () => {
  const result = exitProceeds({ ...base, valueCents: toCents(15_000_000) })

  it('pays $37,500, your share of the preference stack', () => {
    expect(result.lowCents).toBe(toCents(37_500))
    expect(result.highCents).toBe(toCents(37_500))
  })

  it('is labelled downside', () => {
    expect(result.regime).toBe('downside')
  })

  it('is well under what ownership times exit value would suggest', () => {
    const naive = Math.round(0.0032 * toCents(15_000_000))
    expect(naive).toBe(toCents(48_000))
    expect(result.lowCents).toBeLessThan(naive)
  })

  it('never pays back more than you put in', () => {
    const atTheMoney = exitProceeds({ ...base, valueCents: toCents(20_000_000) })
    expect(atTheMoney.lowCents).toBe(toCents(50_000))
  })
})

describe('the band between the two regimes', () => {
  const banded = exitProceeds({ ...base, valueCents: toCents(30_000_000) })

  it('admits it cannot pin the number down', () => {
    expect(banded.regime).toBe('uncertain')
    expect(banded.uncertain).toBe(true)
  })

  it('brackets the answer between the preference floor and full conversion', () => {
    expect(banded.lowCents).toBe(toCents(50_000))
    expect(banded.highCents).toBe(toCents(96_000))
    expect(banded.lowCents).toBeLessThan(banded.highCents)
  })

  it('says why, in terms the reader can act on', () => {
    expect(banded.explanation).toMatch(/preference/i)
  })

  it('closes the band once the exit clears the threshold', () => {
    const clean = exitProceeds({ ...base, valueCents: toCents(40_000_001) })
    expect(clean.regime).toBe('clean')
    expect(clean.lowCents).toBe(clean.highCents)
  })

  it('lets the caller move the threshold and documents its default', () => {
    const strict = exitProceeds({ ...base, valueCents: toCents(60_000_000), cleanMultiple: 5 })
    expect(strict.regime).toBe('uncertain')
  })
})

describe('every result carries a regime', () => {
  it('for any exit value at all', () => {
    for (const millions of [0, 1, 19.99, 20, 20.01, 39, 40, 41, 1000]) {
      const result = exitProceeds({ ...base, valueCents: toCents(millions * 1_000_000) })
      expect(['downside', 'uncertain', 'clean']).toContain(result.regime)
      expect(result.explanation.length).toBeGreaterThan(0)
    }
  })

  it('never pays out more than the company sold for', () => {
    for (const millions of [0.5, 5, 20, 35, 60, 200]) {
      const result = exitProceeds({ ...base, valueCents: toCents(millions * 1_000_000) })
      expect(result.highCents).toBeLessThanOrEqual(toCents(millions * 1_000_000))
    }
  })
})

describe('a loan that never converted is repaid first', () => {
  const loan: ExitInput = {
    ...base,
    ownership: 0,
    unconvertedLoanOwedCents: toCents(62_000),
  }

  it('pays principal plus interest ahead of every equity holder', () => {
    const result = exitProceeds({ ...loan, valueCents: toCents(15_000_000) })
    expect(result.lowCents).toBe(toCents(62_000))
    expect(result.regime).toBe('downside')
    expect(result.explanation).toMatch(/loan/i)
  })

  it('beats the equity treatment of the same money in a bad exit', () => {
    const asEquity = exitProceeds({ ...base, valueCents: toCents(15_000_000) })
    const asLoan = exitProceeds({ ...loan, valueCents: toCents(15_000_000) })
    expect(asLoan.lowCents).toBeGreaterThan(asEquity.lowCents)
  })

  it('cannot recover more than the company sold for', () => {
    const wipeout = exitProceeds({ ...loan, valueCents: toCents(40_000) })
    expect(wipeout.lowCents).toBe(toCents(40_000))
  })
})
