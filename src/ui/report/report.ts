import { endings } from '../../engine/endings'
import type { EndingKind } from '../../engine/endings'
import type { ScenarioResult } from '../../engine/scenario'
import type { Instrument, Round, Scenario } from '../../engine/types'
import { stakeNotes, stakeRows } from '../facts'
import { compactMoney, conversionRoute, longDate, money, multiple, ownership, percent, roundName } from '../format'

/**
 * Everything the deal PDF prints, as plain text, worked out from the same run
 * the calculator shows. Nothing here knows about pages or fonts: `pdf.ts` only
 * lays this out, so the wording and every figure can be tested without a PDF.
 */

export interface Row {
  cells: string[]
  /** A line under the first cell, such as where a SAFE converted. */
  note?: string | undefined
  /** The row that matters most: the exit, or the outcome the slider is on. */
  emphasis?: boolean | undefined
}

export interface Table {
  columns: string[]
  rows: Row[]
}

export interface Headline {
  label: string
  value: string
  tone?: 'gain' | 'dilute' | undefined
}

export interface Report {
  title: string
  subtitle: string
  generated: string
  /** The figures that answer "how did it go", large, across the top. */
  headline: Headline[]
  terms: Array<[string, string]>
  /** Where a SAFE or note stands: converted, repaid, or not yet. */
  status?: string | undefined
  summary: Array<[string, string]>
  /** Said when liquidation preferences could change the answer. */
  caution?: string | undefined
  rounds?: Table | undefined
  endings?: Table | undefined
  disclaimer: string
}

const INSTRUMENT_TITLE: Record<Instrument['type'], string> = { equity: 'Shares', safe: 'SAFE', cla: 'Convertible note' }

const ENDING_TITLES: Record<EndingKind, string> = {
  fails: 'The company fails',
  capital: 'It returns its capital',
  grows10: 'It grows 10×',
  grows100: 'It grows 100×',
}

export const DISCLAIMER =
  'Educational and informational only. Results are hypothetical and depend on the assumptions entered; they are not a forecast and ' +
  'not investment, legal, tax or financial advice. Built from the angel’s side only: later investors are assumed to hold a standard 1× ' +
  'non-participating liquidation preference.'

const MATURITY_OUTCOME = { repay: 'repaid', convert: 'converts', extend: 'extended' } as const

export function buildReport(scenario: Scenario, run: ScenarioResult, today: Date = new Date()): Report {
  const cur = scenario.currency
  const $ = (cents: number) => money(cents, cur)
  const $$ = (cents: number) => compactMoney(cents, cur)
  const range = (low: string, high: string) => (low === high ? high : `${low} – ${high}`)

  const entryRound = scenario.rounds[0] as Round
  const cheque = entryRound.participation as Instrument
  const convertible = cheque.type !== 'equity'
  const entryState = run.rounds.find((r) => r.round.id === entryRound.id)
  const initialCents = entryState?.investedCents ?? 0
  const exitCents = scenario.exit.valueCents
  const { feesLow: low, feesHigh: high } = run

  const valuationWord = convertible ? 'cap' : 'valuation'
  const subtitle = [
    `${INSTRUMENT_TITLE[cheque.type]} at a ${$$(entryRound.valuationCents)} ${entryRound.valuationBasis}-money ${valuationWord}`,
    convertible && (cheque.discount ?? 0) > 0 ? `${percent(cheque.discount ?? 0, 0)} discount` : undefined,
    cheque.type === 'cla' && (cheque.interestRate ?? 0) > 0 ? `${percent(cheque.interestRate ?? 0, 0)} interest` : undefined,
    scenario.rounds.length > 1 ? `${scenario.rounds.length - 1} later round${scenario.rounds.length > 2 ? 's' : ''}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')

  const headline: Headline[] = [
    { label: 'Total invested', value: $(run.totalInvestedCents) },
    { label: 'Final ownership', value: ownership(run.finalOwnership) },
  ]
  if (exitCents > 0) {
    headline.push(
      { label: `Net at a ${$$(exitCents)} exit`, value: range($(low.netCents), $(high.netCents)), tone: 'gain' },
      { label: 'Multiple', value: range(multiple(low.netMultiple), multiple(high.netMultiple)) },
    )
  }

  const terms: Array<[string, string]> = [
    ['Instrument', INSTRUMENT_TITLE[cheque.type]],
    ['Investment', $(cheque.amountCents)],
    ['Round', `${roundName(entryRound)}, ${longDate(entryRound.date)}`],
    [convertible ? 'Valuation cap' : 'Valuation', `${$(entryRound.valuationCents)} ${entryRound.valuationBasis}-money`],
    [convertible ? 'Raised on these terms' : 'Amount raised', $(entryRound.raisedCents)],
  ]
  if (convertible) terms.push(['Discount', (cheque.discount ?? 0) > 0 ? percent(cheque.discount ?? 0, 0) : 'None'])
  if (cheque.type === 'cla') {
    terms.push(['Interest', `${percent(cheque.interestRate ?? 0, 0)} a year, ${cheque.interestMode === 'compound' ? 'compounding' : 'simple'}`])
    if (cheque.maturityDate) {
      const outcome = cheque.atMaturity ?? 'repay'
      const at = outcome === 'convert' ? ` at ${$(cheque.maturityValuationCents ?? entryRound.valuationCents)}` : ''
      terms.push(['Maturity', `${longDate(cheque.maturityDate)}, ${MATURITY_OUTCOME[outcome]}${at}`])
    }
  }
  if (entryState && entryState.entryFeeCents > 0) terms.push(['Entry fee', $(entryState.entryFeeCents)])
  if (scenario.fees.carry.percent > 0) terms.push(['Carry', percent(scenario.fees.carry.percent, 0)])
  if (scenario.fees.management) {
    const m = scenario.fees.management
    terms.push(['Management fee', `${percent(m.annualPercent, 1)} a year for ${m.years} years`])
  }
  if (exitCents > 0) terms.push(['Exit', `${$(exitCents)}, ${longDate(scenario.exit.date)}`])
  if (scenario.exit.totalRaisedCents > 0) terms.push(['Company raised in total', $(scenario.exit.totalRaisedCents)])

  const conversion = run.rounds.find((r) => r.conversion)
  let status: string | undefined
  if (run.maturity?.outcome === 'repay') {
    status = `Repaid at maturity on ${longDate(run.maturity.date)}: ${$(run.maturity.repaidCents)} back, including ${$(run.maturity.accruedCents)} of interest. No shares after that.`
  } else if (run.maturity?.outcome === 'convert') {
    status = `Converts at maturity on ${longDate(run.maturity.date)} at ${$(run.maturity.valuationPostCents)}: ${ownership(run.maturity.stake)}, before later rounds dilute it.`
  } else if (conversion?.conversion) {
    const c = conversion.conversion
    status = `Converts in ${roundName(conversion.round)} at ${conversionRoute(c.route, cheque.discount)}: ${ownership(c.ownership)} once that round closes.`
    if (c.accruedCents > 0) status += ` Includes ${$(c.accruedCents)} of interest, which is not money you paid.`
  } else if (run.entry.kind === 'pending') {
    status = 'Not converted yet: ownership is shown at the cap until a priced round.'
  }
  if (status && run.entry.estimate) status += ' A pre-money cap makes this an estimate.'

  const summary: Array<[string, string]> = [
    [`Initial investment (${roundName(entryRound)})`, $(initialCents)],
    [run.entry.kind === 'priced' ? 'Initial ownership' : 'Initial ownership, at the cap', ownership(entryState?.ownershipAfter ?? 0)],
    ['Follow-on investments', $(run.totalInvestedCents - initialCents)],
    ['Total invested', $(run.totalInvestedCents)],
    ['Final ownership', ownership(run.finalOwnership)],
  ]
  if (exitCents > 0) {
    summary.push([`Gross proceeds at ${$$(exitCents)}`, range($(low.grossCents), $(high.grossCents))])
    if (run.maturity?.outcome === 'repay') summary.push(['Of which repaid at maturity', $(run.maturity.repaidCents)])
    if (high.dragCents > 0) {
      const fees = low.entryFeeCents > 0 || low.managementFeeCents > 0 ? 'Carry and fees' : `Carry (${percent(scenario.fees.carry.percent, 0)})`
      summary.push([fees, `-${range($(low.dragCents), $(high.dragCents))}`])
    }
    summary.push(['Net proceeds', range($(low.netCents), $(high.netCents))])
    summary.push(['Multiple', range(multiple(low.netMultiple), multiple(high.netMultiple))])
  }

  const caution =
    exitCents <= 0 || run.exit.regime === 'clean'
      ? undefined
      : run.exit.regime === 'downside'
        ? `At or below the ${$$(scenario.exit.totalRaisedCents)} the company raised, liquidation preferences pay later investors first, so you may receive less.`
        : `Close to the ${$$(scenario.exit.totalRaisedCents)} the company raised, liquidation preferences decide where in this range you land.`

  let rounds: Table | undefined
  if (scenario.rounds.length > 1) {
    const note = stakeNotes(run.rounds, run.maturity)
    const rows: Row[] = stakeRows(run.rounds).map((s) => ({
      cells: [
        roundName(s.round),
        longDate(s.round.date),
        $(s.postMoneyCents),
        s.investedCents > 0 ? $(s.investedCents) : '—',
        ownership(s.ownershipAfter),
        $(s.stakeValueCents),
      ],
      note: note(s),
    }))
    if (exitCents > 0 && run.totalInvestedCents > 0) {
      rows.push({
        cells: [`Exit at ${$$(exitCents)}`, longDate(scenario.exit.date), $(exitCents), '—', ownership(run.finalOwnership), range($(low.grossCents), $(high.grossCents))],
        note: high.carryCents > 0 ? `${range($(low.netCents), $(high.netCents))} after carry` : undefined,
        emphasis: true,
      })
    }
    rounds = { columns: ['Round', 'Date', 'Post-money', 'Your cheque', 'Ownership', 'Paper value'], rows }
  }

  const result = endings(scenario, run)
  let endingsTable: Table | undefined
  if (result) {
    const charged = result.rows.some((r) => r.outcome.feesHigh.dragCents > 0)
    endingsTable = {
      columns: ['Outcome', 'Company sells for', 'You get', ...(charged ? ['After fees'] : []), 'Your multiple'],
      rows: result.rows.map((row) => ({
        cells: [
          ENDING_TITLES[row.kind],
          $(row.valueCents),
          range($(row.outcome.feesLow.grossCents), $(row.outcome.feesHigh.grossCents)),
          ...(charged ? [range($(row.outcome.feesLow.netCents), $(row.outcome.feesHigh.netCents))] : []),
          range(multiple(row.outcome.feesLow.netMultiple), multiple(row.outcome.feesHigh.netMultiple)),
        ],
        emphasis: row.valueCents > 0 && row.valueCents === exitCents,
      })),
    }
  }

  return {
    title: `${$(cheque.amountCents)} into ${roundName(entryRound)}`,
    subtitle,
    generated: longDate(today.toISOString().slice(0, 10)),
    headline,
    terms,
    status,
    summary,
    caution,
    rounds,
    endings: endingsTable,
    disclaimer: DISCLAIMER,
  }
}

/** A file name people can recognise in their downloads: the round and the day. */
export function reportFileName(scenario: Scenario, today: Date = new Date()): string {
  const round = (scenario.rounds[0] ? roundName(scenario.rounds[0]) : 'deal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `tinypercent-${round || 'deal'}-${today.toISOString().slice(0, 10)}.pdf`
}
