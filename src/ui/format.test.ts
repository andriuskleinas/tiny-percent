import { describe, expect, it } from 'vitest'
import { compactMoney, money, moneyInputText, multiple, ownership, parseMoney, symbolFor } from './format'

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

describe('typed money is read the way people write it', () => {
  it.each([
    ['5000', 500_000],
    ['5,000', 500_000],
    ['€ 5,000', 500_000],
    ['5k', 500_000],
    ['2.5K', 250_000],
    ['4m', 400_000_000],
    ['1.2M', 120_000_000],
    ['1b', 100_000_000_000],
    ['1bn', 100_000_000_000],
    ['0.5', 50],
    ['  12 500 ', 1_250_000],
  ])('reads %s', (text, cents) => {
    expect(parseMoney(text)).toBe(cents)
  })

  it.each([[''], ['   '], ['abc'], ['5x'], ['1.2.3'], ['-5']])('treats %j as nothing', (text) => {
    expect(parseMoney(text)).toBeUndefined()
  })

  it('writes an amount back with thousands separators, and zero as empty', () => {
    expect(moneyInputText(2_400_000_000)).toBe('24,000,000')
    expect(moneyInputText(123_456)).toBe('1,234.56')
    expect(moneyInputText(0)).toBe('')
  })
})

describe('multiples and small ownerships stay readable', () => {
  it.each([
    [25.6, '25.6×'],
    [16, '16×'],
    [21.333, '21.3×'],
    [1.04, '1.04×'],
    [0.3125, '0.31×'],
    [128, '128×'],
    [0, '0×'],
  ])('writes a multiple of %s as %s', (x, text) => {
    expect(multiple(x)).toBe(text)
  })

  it.each([
    [0.005, '0.50%'],
    [0.001, '0.10%'],
    [0.000512, '0.051%'],
    [0.00064, '0.064%'],
    [0.25, '25.00%'],
    [0, '0%'],
  ])('writes an ownership of %s as %s', (fraction, text) => {
    expect(ownership(fraction)).toBe(text)
  })
})
