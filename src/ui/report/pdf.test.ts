import { describe, expect, it } from 'vitest'
import { toCents } from '../../engine/money'
import { runScenario } from '../../engine/scenario'
import type { Round, Scenario } from '../../engine/types'
import { CONVERTIBLE_LOAN, HERO_EXAMPLE } from '../../state/presets'
import { pdfSafe, reportPdf } from './pdf'
import { buildReport } from './report'

const pdf = (s: Scenario) => reportPdf(buildReport(s, runScenario(s), new Date('2026-10-23')))
const bytes = (s: Scenario) => new Uint8Array(pdf(s).output('arraybuffer'))

describe('the deal PDF', () => {
  it('is a real PDF file', () => {
    const head = new TextDecoder().decode(bytes(HERO_EXAMPLE).slice(0, 5))
    expect(head).toBe('%PDF-')
  })

  it('fits a typical deal on one page', () => {
    expect(pdf(HERO_EXAMPLE).getNumberOfPages()).toBe(1)
    expect(pdf(CONVERTIBLE_LOAN).getNumberOfPages()).toBe(1)
  })

  it('runs onto more pages for a long deal rather than off the edge', () => {
    const later: Round[] = Array.from({ length: 12 }, (_, i) => ({
      id: `r${i}`,
      label: `Round ${i + 1}`,
      date: `${2027 + i}-01-01`,
      valuationCents: toCents(10_000_000 * 2 ** i),
      valuationBasis: 'pre',
      raisedCents: toCents(2_000_000 * 2 ** i),
      participation: { type: 'equity', amountCents: toCents(1_000), entryFee: { rule: 'percent', percent: 0 } },
    }))
    const long = { ...HERO_EXAMPLE, rounds: [HERO_EXAMPLE.rounds[0]!, ...later] }
    expect(pdf(long).getNumberOfPages()).toBeGreaterThan(1)
  })

  it('stays small, because no font or image is embedded', () => {
    expect(bytes(CONVERTIBLE_LOAN).byteLength).toBeLessThan(20_000)
  })
})

describe('text the built-in fonts can draw', () => {
  it('keeps euros, multiples, dashes and dots', () => {
    expect(pdfSafe('€5,000 · 25.6× – 0.10% ÷ ’')).toBe('€5,000 · 25.6× – 0.10% ÷ ’')
  })

  it('swaps what they cannot draw for its nearest equivalent', () => {
    expect(pdfSafe('−€28,127')).toBe('-€28,127')
    expect(pdfSafe('a b')).toBe('a b')
    expect(pdfSafe('日本')).toBe('??')
  })
})
