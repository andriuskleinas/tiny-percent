import { describe, expect, it } from 'vitest'
import { compactMoney, money, symbolFor } from './format'

describe('money is formatted in the currency it is given', () => {
  it('writes dollars, euros and pounds', () => {
    expect(money(5_000_000, 'USD')).toBe('$50,000')
    expect(money(5_000_000, 'EUR')).toBe('€50,000')
    expect(money(5_000_000, 'GBP')).toBe('£50,000')
  })

  it('abbreviates for charts in the same currency', () => {
    expect(compactMoney(1_000_000_000, 'EUR')).toBe('€10M')
    expect(compactMoney(19_200_000, 'GBP')).toBe('£192K')
  })

  it('knows the symbol for an input prefix', () => {
    expect(symbolFor('USD')).toBe('$')
    expect(symbolFor('EUR')).toBe('€')
    expect(symbolFor('GBP')).toBe('£')
  })
})
