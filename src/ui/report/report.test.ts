import { describe, expect, it } from 'vitest'
import { toCents } from '../../engine/money'
import { runScenario } from '../../engine/scenario'
import type { Scenario } from '../../engine/types'
import { CONVERTIBLE_LOAN, HERO_EXAMPLE, SAFE_AT_A_CAP } from '../../state/presets'
import { buildReport, reportFileName } from './report'

/**
 * The PDF prints what the calculator shows. Every figure here is the same
 * engine run the page uses, so these check the wording and that nothing is
 * left out, against the €5,000 example of golden case L.
 */

const DAY = new Date('2026-10-23T12:00:00Z')
const report = (s: Scenario) => buildReport(s, runScenario(s), DAY)

describe('the €5,000 example', () => {
  const r = report(HERO_EXAMPLE)

  it('names the deal and the day', () => {
    expect(r.title).toBe('€5,000 into Pre-seed')
    expect(r.subtitle).toBe('Shares at a €4M pre-money valuation · 3 later rounds')
    expect(r.generated).toBe('Oct 23, 2026')
  })

  it('leads with what was invested, what is owned and what the exit returns', () => {
    expect(r.headline.map((h) => [h.label, h.value])).toEqual([
      ['Total invested', '€5,000'],
      ['Final ownership', '0.051%'],
      ['Net at a €250M exit', '€128,000'],
      ['Multiple', '25.6×'],
    ])
  })

  it('lists every round and ends the table with the exit', () => {
    const rows = r.rounds?.rows ?? []
    expect(rows.map((row) => row.cells[0])).toEqual(['Pre-seed', 'Seed', 'Series A', 'Series B', 'Exit at €250M'])
    expect(rows[1]?.cells).toEqual(['Seed', 'Sep 1, 2027', '€15,000,000', '—', '0.080%', '€12,000'])
    expect(rows.at(-1)?.emphasis).toBe(true)
  })

  it('includes the four endings, with the ranges the page shows', () => {
    expect(r.endings?.rows.map((row) => row.cells)).toEqual([
      ['The company fails', '€0', '€0', '0×'],
      ['It returns its capital', '€32,000,000', '€5,000', '1×'],
      ['It grows 10×', '€50,000,000', '€5,000 – €25,600', '1× – 5.12×'],
      ['It grows 100×', '€500,000,000', '€256,000', '51.2×'],
    ])
  })

  it('carries the disclaimer and no caution on a clean exit', () => {
    expect(r.disclaimer).toContain('not investment, legal, tax or financial advice')
    expect(r.caution).toBeUndefined()
  })
})

describe('a SAFE or note', () => {
  it('says where a note converted, and that its interest is not money paid', () => {
    const r = report(CONVERTIBLE_LOAN)
    expect(r.status).toMatch(/^Converts in Seed at the cap: 0\.93% once that round closes\. Includes €8,0\d\d of interest/)
    expect(r.terms).toContainEqual(['Interest', '8% a year, simple'])
    expect(r.rounds?.rows[0]?.note).toBe('Note, at the cap')
    expect(r.rounds?.rows[1]?.note).toBe('Note converts at the cap')
  })

  it('says a SAFE with no round after it has not converted', () => {
    const r = report({ ...SAFE_AT_A_CAP, rounds: SAFE_AT_A_CAP.rounds.slice(0, 1) })
    expect(r.status).toBe('Not converted yet: ownership is shown at the cap until a priced round.')
    expect(r.rounds).toBeUndefined()
  })

  it('says when a note was repaid at maturity', () => {
    const [first, ...rest] = CONVERTIBLE_LOAN.rounds
    if (!first?.participation) throw new Error('preset has no note')
    const r = report({ ...CONVERTIBLE_LOAN, rounds: [{ ...first, participation: { ...first.participation, maturityDate: '2024-01-01' } }, ...rest] })
    expect(r.terms).toContainEqual(['Maturity', 'Jan 1, 2024, repaid'])
    expect(r.status).toBe('Repaid at maturity on Jan 1, 2024: €54,000 back, including €4,000 of interest. No shares after that.')
    expect(r.summary).toContainEqual(['Of which repaid at maturity', '€54,000'])
  })
})

it('warns when liquidation preferences could decide the answer', () => {
  const r = report({ ...HERO_EXAMPLE, exit: { ...HERO_EXAMPLE.exit, valueCents: toCents(20_000_000) } })
  expect(r.caution).toContain('liquidation preferences pay later investors first')
})

it('names the file after the round and the day', () => {
  expect(reportFileName(HERO_EXAMPLE, DAY)).toBe('tinypercent-pre-seed-2026-10-23.pdf')
  expect(reportFileName({ ...HERO_EXAMPLE, rounds: [{ ...HERO_EXAMPLE.rounds[0]!, label: '  ' }] }, DAY)).toBe(
    'tinypercent-untitled-round-2026-10-23.pdf',
  )
})
