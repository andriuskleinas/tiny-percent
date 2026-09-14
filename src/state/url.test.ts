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
      rounds: WORKED_EXAMPLE.rounds.map((r, i) => ({
        ...r,
        newOptionPool: 0.1,
        ...(i === 0
          ? {
              participation: {
                type: 'cla' as const,
                amountCents: toCents(50_000),
                entryFee: { rule: 'greater_of' as const, percent: 0.02, fixedCents: toCents(2_500) },
              },
            }
          : { participation: { type: 'equity' as const, amountCents: toCents(12_345), entryFee: { rule: 'fixed' as const, fixedCents: toCents(500) } } }),
      })),
      fees: {
        management: { annualPercent: 0.02, years: 10 },
        carry: { percent: 0.2, basis: 'per_deal' as const },
      },
      exit: { ...WORKED_EXAMPLE.exit, date: '2030-06-30' },
    }
    expect(decodeScenario(encodeScenario(loaded))).toEqual(loaded)
  })

  it('survives labels that are not plain ASCII', () => {
    const accented = {
      ...WORKED_EXAMPLE,
      rounds: WORKED_EXAMPLE.rounds.map((r) => ({ ...r, id: `${r.id}-日本` })),
    }
    expect(decodeScenario(encodeScenario(accented))?.rounds[0]?.id).toBe('a-日本')
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
    ['a future version', { ...WORKED_EXAMPLE, version: 3 }],
    ['an unknown currency', { ...WORKED_EXAMPLE, currency: 'GBP' }],
    [
      'an unknown instrument',
      {
        ...WORKED_EXAMPLE,
        rounds: [{ ...WORKED_EXAMPLE.rounds[0], participation: { ...WORKED_EXAMPLE.rounds[0]?.participation, type: 'nft' } }],
      },
    ],
    ['no rounds', { ...WORKED_EXAMPLE, rounds: [] }],
    [
      'a round that skips the entry',
      { ...WORKED_EXAMPLE, rounds: [{ ...WORKED_EXAMPLE.rounds[0], participation: undefined }, ...WORKED_EXAMPLE.rounds.slice(1)] },
    ],
    [
      'a zero valuation, which would divide by zero',
      { ...WORKED_EXAMPLE, rounds: [{ ...WORKED_EXAMPLE.rounds[0], valuationCents: 0 }] },
    ],
    [
      'a negative cheque',
      {
        ...WORKED_EXAMPLE,
        rounds: [{ ...WORKED_EXAMPLE.rounds[0], participation: { ...WORKED_EXAMPLE.rounds[0]?.participation, amountCents: -1 } }],
      },
    ],
    [
      'an amount that is not a number',
      {
        ...WORKED_EXAMPLE,
        rounds: [{ ...WORKED_EXAMPLE.rounds[0], participation: { ...WORKED_EXAMPLE.rounds[0]?.participation, amountCents: 'lots' } }],
      },
    ],
    [
      'an infinite valuation',
      { ...WORKED_EXAMPLE, exit: { ...WORKED_EXAMPLE.exit, valueCents: Number.POSITIVE_INFINITY } },
    ],
    ['missing fees', { ...WORKED_EXAMPLE, fees: undefined }],
    ['a prototype-pollution attempt', JSON.parse('{"__proto__":{"polluted":true},"version":2}')],
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
