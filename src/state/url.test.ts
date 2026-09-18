import { describe, expect, it } from 'vitest'
import { toCents } from '../engine/money'
import { runScenario } from '../engine/scenario'
import { WORKED_EXAMPLE, blankScenario } from './presets'
import { decodeScenario, decodeShared, encodeScenario, encodeShared, scenarioFromAddress } from './url'

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

  it('round-trips a blank form, zero valuation and all', () => {
    const blank = blankScenario('EUR', new Date('2026-09-14T12:00:00Z'))
    expect(decodeScenario(encodeScenario(blank))).toEqual(blank)
  })

  it('round-trips a custom round name', () => {
    const custom = { ...WORKED_EXAMPLE, rounds: WORKED_EXAMPLE.rounds.map((r, i) => (i === 1 ? { ...r, label: 'Bridge round' } : r)) }
    expect(decodeScenario(encodeScenario(custom))?.rounds[1]?.label).toBe('Bridge round')
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
      'a negative valuation',
      { ...WORKED_EXAMPLE, rounds: [{ ...WORKED_EXAMPLE.rounds[0], valuationCents: -1 }] },
    ],
    [
      'a round name longer than anyone would type',
      { ...WORKED_EXAMPLE, rounds: [{ ...WORKED_EXAMPLE.rounds[0], label: 'x'.repeat(41) }] },
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

describe('a link shared before the redesign', () => {
  // Pasted by the user on 2026-09-16: the €5,000 example, following on pro-rata
  // at every round, with 20% carry. The schema did not change, so it must open
  // onto exactly the figures it showed then.
  const LINK =
    'eyJ2ZXJzaW9uIjoyLCJjdXJyZW5jeSI6IkVVUiIsInJvdW5kcyI6W3siaWQiOiJzZWVkIiwibGFiZWwiOiJTZWVkIiwiZGF0ZSI6IjIwMjYtMDEtMTUiLCJ2YWx1YXRpb25DZW50cyI6NDAwMDAwMDAwLCJ2YWx1YXRpb25CYXNpcyI6InByZSIsInJhaXNlZENlbnRzIjoxMDAwMDAwMDAsInBhcnRpY2lwYXRpb24iOnsidHlwZSI6ImVxdWl0eSIsImFtb3VudENlbnRzIjo1MDAwMDAsImVudHJ5RmVlIjp7InJ1bGUiOiJwZXJjZW50IiwicGVyY2VudCI6MH19fSx7ImlkIjoic2VyaWVzLWEiLCJsYWJlbCI6IlNlcmllcyBBIiwiZGF0ZSI6IjIwMjctMDktMDEiLCJ2YWx1YXRpb25DZW50cyI6MTUwMDAwMDAwMCwidmFsdWF0aW9uQmFzaXMiOiJwb3N0IiwicmFpc2VkQ2VudHMiOjMwMDAwMDAwMCwicGFydGljaXBhdGlvbiI6eyJ0eXBlIjoiZXF1aXR5IiwiYW1vdW50Q2VudHMiOjMwMDAwMCwiZW50cnlGZWUiOnsicnVsZSI6InBlcmNlbnQiLCJwZXJjZW50IjowfX19LHsiaWQiOiJzZXJpZXMtYiIsImxhYmVsIjoiU2VyaWVzIEIiLCJkYXRlIjoiMjAyOS0wOS0wMSIsInZhbHVhdGlvbkNlbnRzIjo0MDAwMDAwMDAwLCJ2YWx1YXRpb25CYXNpcyI6InBvc3QiLCJyYWlzZWRDZW50cyI6ODAwMDAwMDAwLCJwYXJ0aWNpcGF0aW9uIjp7InR5cGUiOiJlcXVpdHkiLCJhbW91bnRDZW50cyI6ODAwMDAwLCJlbnRyeUZlZSI6eyJydWxlIjoicGVyY2VudCIsInBlcmNlbnQiOjB9fX0seyJpZCI6InNlcmllcy1jIiwibGFiZWwiOiJTZXJpZXMgQyIsImRhdGUiOiIyMDMxLTA5LTAxIiwidmFsdWF0aW9uQ2VudHMiOjEwMDAwMDAwMDAwLCJ2YWx1YXRpb25CYXNpcyI6InBvc3QiLCJyYWlzZWRDZW50cyI6MjAwMDAwMDAwMCwicGFydGljaXBhdGlvbiI6eyJ0eXBlIjoiZXF1aXR5IiwiYW1vdW50Q2VudHMiOjIwMDAwMDAsImVudHJ5RmVlIjp7InJ1bGUiOiJwZXJjZW50IiwicGVyY2VudCI6MH19fV0sImZlZXMiOnsiY2FycnkiOnsicGVyY2VudCI6MC4yLCJiYXNpcyI6InBlcl9kZWFsIn19LCJleGl0Ijp7ImRhdGUiOiIyMDM0LTAxLTE1IiwidmFsdWVDZW50cyI6MjUwMDAwMDAwMDAsInRvdGFsUmFpc2VkQ2VudHMiOjMyMDAwMDAwMDB9fQ'

  it('decodes and runs to €36,000 invested, 0.10% held and €250,000 gross at €250M', () => {
    const scenario = decodeScenario(LINK)
    expect(scenario).toBeDefined()
    const run = runScenario(scenario!)
    expect(run.totalInvestedCents).toBe(toCents(36_000))
    expect(run.finalOwnership).toBeCloseTo(0.001, 12)
    expect(run.exit.highCents).toBe(toCents(250_000))
    expect(run.feesHigh.netCents).toBe(toCents(207_200))
    expect(run.feesHigh.netMultiple).toBeCloseTo(5.7556, 4)
  })
})

describe('a /shared link', () => {
  it('round-trips the scenario, compressed well below the older format', async () => {
    const code = await encodeShared(WORKED_EXAMPLE)
    expect(await decodeShared(code)).toEqual(WORKED_EXAMPLE)
    expect(code.length).toBeLessThan(encodeScenario(WORKED_EXAMPLE).length / 2)
  })

  it('refuses a code that is not compressed data, or not a scenario once unpacked', async () => {
    expect(await decodeShared('not-a-scenario')).toBeUndefined()
    expect(await decodeShared('')).toBeUndefined()
    expect(await decodeShared(encodeScenario(WORKED_EXAMPLE))).toBeUndefined()
  })

  it('refuses a code that unpacks to something far bigger than any scenario', async () => {
    const huge = new TextEncoder().encode(' '.repeat(200_000))
    const packed = await new Response(new Response(huge).body!.pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()
    const code = btoa(String.fromCharCode(...new Uint8Array(packed))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await decodeShared(code)).toBeUndefined()
  })

  it('is read from /shared, while the older #s= style still works anywhere', async () => {
    const code = await encodeShared(WORKED_EXAMPLE)
    expect(await scenarioFromAddress({ pathname: '/shared', hash: `#${code}` })).toEqual(WORKED_EXAMPLE)
    expect(await scenarioFromAddress({ pathname: '/', hash: `#${code}` })).toBeUndefined()
    expect(await scenarioFromAddress({ pathname: '/', hash: `#s=${encodeScenario(WORKED_EXAMPLE)}` })).toEqual(WORKED_EXAMPLE)
  })
})
