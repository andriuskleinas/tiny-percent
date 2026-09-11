import { describe, expect, it } from 'vitest'
import { toCents } from '../engine/money'
import { runScenario } from '../engine/scenario'
import { WORKED_EXAMPLE } from './presets'
import { decodeScenario, encodeScenario } from './url'

describe('a shared link carries the exact scenario', () => {
  it('round-trips the worked example unchanged', () => {
    expect(decodeScenario(encodeScenario(WORKED_EXAMPLE))).toEqual(WORKED_EXAMPLE)
  })

  it('round-trips a scenario using every optional field', () => {
    const loaded = {
      ...WORKED_EXAMPLE,
      currency: 'EUR' as const,
      entry: {
        type: 'cla' as const,
        amountCents: toCents(50_000),
        date: '2019-06-01',
        capCents: toCents(5_000_000),
        discount: 0.2,
        interestRate: 0.08,
        interestMode: 'compound' as const,
        maturityDate: '2022-06-01',
        otherConvertingCents: toCents(250_000),
      },
      rounds: WORKED_EXAMPLE.rounds.map((r, i) => ({
        ...r,
        newOptionPool: 0.1,
        convertsHere: i === 0,
        angelAction: { kind: 'custom' as const, amountCents: toCents(12_345) },
      })),
      fees: {
        entry: {
          rule: 'greater_of' as const,
          percent: 0.02,
          fixedCents: toCents(2_500),
          charged: 'deducted' as const,
        },
        management: { annualPercent: 0.02, years: 10, source: 'capital' as const },
        carry: { percent: 0.2, hurdlePercent: 0.08, basis: 'per_deal' as const },
      },
      exit: { ...WORKED_EXAMPLE.exit, unconvertedLoan: 'extend' as const },
    }
    expect(decodeScenario(encodeScenario(loaded))).toEqual(loaded)
  })

  it('survives labels that are not plain ASCII', () => {
    const accented = {
      ...WORKED_EXAMPLE,
      rounds: WORKED_EXAMPLE.rounds.map((r) => ({ ...r, label: `Série ${r.label} — 日本` })),
    }
    expect(decodeScenario(encodeScenario(accented))?.rounds[0]?.label).toBe('Série Series A — 日本')
  })

  it('produces a link short enough to paste into a message', () => {
    expect(encodeScenario(WORKED_EXAMPLE).length).toBeLessThan(2000)
  })

  it('uses only characters that are safe in a URL', () => {
    expect(encodeScenario(WORKED_EXAMPLE)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('decodes to something the engine can actually run', () => {
    const decoded = decodeScenario(encodeScenario(WORKED_EXAMPLE))
    expect(decoded).toBeDefined()
    expect(runScenario(decoded as typeof WORKED_EXAMPLE).finalOwnership).toBeCloseTo(0.0032, 12)
  })
})

describe('a link that is malformed or hostile is refused, never trusted', () => {
  const rejected: Array<[string, string]> = [
    ['empty', ''],
    ['not base64', '!!!!'],
    ['not JSON', btoa('hello').replace(/=+$/, '')],
    ['an array', btoa('[1,2,3]').replace(/=+$/, '')],
    ['null', btoa('null').replace(/=+$/, '')],
    ['a bare string', btoa('"nope"').replace(/=+$/, '')],
  ]

  it.each(rejected)('refuses %s', (_name, payload) => {
    expect(decodeScenario(payload)).toBeUndefined()
  })

  const broken: Array<[string, unknown]> = [
    ['a future version', { ...WORKED_EXAMPLE, version: 2 }],
    ['an unknown currency', { ...WORKED_EXAMPLE, currency: 'XYZ' }],
    ['an unknown instrument', { ...WORKED_EXAMPLE, entry: { ...WORKED_EXAMPLE.entry, type: 'nft' } }],
    ['no rounds', { ...WORKED_EXAMPLE, rounds: [] }],
    ['a zero pre-money, which would divide by zero', {
      ...WORKED_EXAMPLE,
      rounds: [{ ...WORKED_EXAMPLE.rounds[0], preMoneyCents: 0 }],
    }],
    ['a negative cheque', {
      ...WORKED_EXAMPLE,
      entry: { ...WORKED_EXAMPLE.entry, amountCents: -1 },
    }],
    ['an amount that is not a number', {
      ...WORKED_EXAMPLE,
      entry: { ...WORKED_EXAMPLE.entry, amountCents: 'lots' },
    }],
    ['an infinite valuation', {
      ...WORKED_EXAMPLE,
      exit: { ...WORKED_EXAMPLE.exit, valueCents: Number.POSITIVE_INFINITY },
    }],
    ['an unknown angel action', {
      ...WORKED_EXAMPLE,
      rounds: [{ ...WORKED_EXAMPLE.rounds[0], angelAction: { kind: 'short_it' } }],
    }],
    ['missing fees', { ...WORKED_EXAMPLE, fees: undefined }],
    ['a prototype-pollution attempt', JSON.parse('{"__proto__":{"polluted":true},"version":1}')],
  ]

  it.each(broken)('refuses %s', (_name, value) => {
    const encoded = encodeScenario(value as never)
    expect(decodeScenario(encoded)).toBeUndefined()
  })

  it('leaves Object.prototype alone after a pollution attempt', () => {
    decodeScenario(encodeScenario(JSON.parse('{"__proto__":{"polluted":true}}') as never))
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })
})
