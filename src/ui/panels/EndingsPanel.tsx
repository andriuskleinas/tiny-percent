import { useId } from 'react'
import { endings } from '../../engine/endings'
import type { Ending, EndingKind, Endings } from '../../engine/endings'
import type { ScenarioResult } from '../../engine/scenario'
import type { Scenario } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { InfoTip } from '../controls'
import { useMoney } from '../currency'
import { multiple } from '../format'

/**
 * Four ways the deal can end, side by side, because a single exit on a slider
 * hides the most important fact about angel investing: most companies fail and
 * a few pay for the rest. Each row is a full engine run, and "Use this exit"
 * moves the slider there, so the rest of the page follows.
 */

const TITLES: Record<EndingKind, string> = {
  fails: 'The company fails',
  capital: 'It returns its capital',
  grows10: 'It grows 10×',
  grows100: 'It grows 100×',
}

export function EndingsPanel({
  scenario,
  run,
  dispatch,
}: {
  scenario: Scenario
  run: ScenarioResult
  dispatch: (action: Action) => void
}) {
  const result = endings(scenario, run)
  if (!result) return null
  return <EndingsBody scenario={scenario} result={result} dispatch={dispatch} convertible={run.entry.kind !== 'priced'} />
}

function EndingsBody({
  scenario,
  result,
  dispatch,
  convertible,
}: {
  scenario: Scenario
  result: Endings
  dispatch: (action: Action) => void
  convertible: boolean
}) {
  const { money, compactMoney } = useMoney()
  const titleId = useId()
  const range = (low: string, high: string) => (low === high ? high : `${low} – ${high}`)
  const charged = result.rows.some((r) => r.outcome.feesHigh.dragCents > 0)
  const from = convertible ? `your ${compactMoney(result.entryPostCents)} cap` : `the ${compactMoney(result.entryPostCents)} you invested at`
  const selected = (row: Ending) => row.valueCents > 0 && row.valueCents === scenario.exit.valueCents

  const detail = (row: Ending): string => {
    if (row.kind === 'fails') return 'Sold for nothing, or wound down'
    if (row.kind === 'capital') return `Sold for the ${compactMoney(row.valueCents)} it raised`
    return `Sold for ${row.kind === 'grows10' ? '10' : '100'}× ${from}`
  }
  const gross = (row: Ending) => range(money(row.outcome.exit.lowCents), money(row.outcome.exit.highCents))
  const net = (row: Ending) => range(money(row.outcome.feesLow.netCents), money(row.outcome.feesHigh.netCents))
  const mult = (row: Ending) => range(multiple(row.outcome.feesLow.netMultiple), multiple(row.outcome.feesHigh.netMultiple))
  const use = (row: Ending) =>
    row.kind === 'fails' ? null : selected(row) ? (
      <span className="text-xs font-medium text-accent">Selected</span>
    ) : (
      <button
        type="button"
        onClick={() => dispatch({ type: 'exit:set', patch: { valueCents: row.valueCents } })}
        aria-label={`Use a ${money(row.valueCents)} exit`}
        className="whitespace-nowrap rounded-full border border-rule px-3 py-1 text-xs font-medium text-ink-soft outline-none transition-colors hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        Use this exit
      </button>
    )
  const tone = (row: Ending) => (row.kind === 'fails' ? 'text-dilute' : 'text-gain')
  const anyRange = result.rows.some((r) => r.outcome.exit.uncertain)

  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-rule bg-surface px-5 py-5 shadow-card sm:px-8 sm:py-6">
      <h3 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
        How it could end
      </h3>
      <p className="mt-1 text-sm text-ink-soft">Most startups fail and a few return everything. Here is your deal at four outcomes.</p>

      <table className="mt-4 hidden w-full border-collapse text-sm sm:table">
        <caption className="sr-only">Your deal at four outcomes</caption>
        <thead>
          <tr className="border-b border-rule-strong text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            <th scope="col" className="py-2 pr-3 font-normal">Outcome</th>
            <th scope="col" className="px-3 py-2 text-right font-normal">Company sells for</th>
            <th scope="col" className="px-3 py-2 text-right font-normal">You get</th>
            {charged ? <th scope="col" className="px-3 py-2 text-right font-normal">After fees</th> : null}
            <th scope="col" className="px-3 py-2 text-right font-normal">Your multiple</th>
            <th scope="col" className="py-2 pl-3 font-normal"><span className="sr-only">Exit</span></th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {result.rows.map((row) => (
            <tr key={row.kind} className={`border-b border-rule ${row.kind === 'fails' ? 'bg-dilute/[0.05]' : selected(row) ? 'bg-accent-wash/50' : ''}`}>
              <th scope="row" className="py-2.5 pr-3 text-left font-sans font-medium text-ink">
                {TITLES[row.kind]}
                <span className="block text-[11px] font-normal text-ink-faint">{detail(row)}</span>
              </th>
              <td className="px-3 py-2.5 text-right text-ink-soft">{money(row.valueCents)}</td>
              <td className={`px-3 py-2.5 text-right ${tone(row)}`}>{gross(row)}</td>
              {charged ? <td className="px-3 py-2.5 text-right text-ink">{net(row)}</td> : null}
              <td className="px-3 py-2.5 text-right text-ink">{mult(row)}</td>
              <td className="py-2.5 pl-3 text-right font-sans">{use(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ol className="mt-4 flex flex-col gap-2 sm:hidden" aria-label="Your deal at four outcomes">
        {result.rows.map((row) => (
          <li
            key={row.kind}
            className={`rounded-xl border p-3 ${row.kind === 'fails' ? 'border-dilute/40 bg-dilute/[0.05]' : selected(row) ? 'border-accent/40 bg-accent-wash/50' : 'border-rule'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-ink">
                {TITLES[row.kind]}
                <span className="block text-xs font-normal text-ink-faint">{detail(row)}</span>
              </p>
              {use(row)}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-ink-faint">Sells for</dt>
              <dd className="text-right font-mono tabular-nums text-ink-soft">{money(row.valueCents)}</dd>
              <dt className="text-ink-faint">You get</dt>
              <dd className={`text-right font-mono tabular-nums ${tone(row)}`}>{gross(row)}</dd>
              {charged ? (
                <>
                  <dt className="text-ink-faint">After fees</dt>
                  <dd className="text-right font-mono tabular-nums text-ink">{net(row)}</dd>
                </>
              ) : null}
              <dt className="text-ink-faint">Multiple</dt>
              <dd className="text-right font-mono tabular-nums text-ink">{mult(row)}</dd>
            </dl>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-start gap-1.5 rounded-xl bg-sunk/60 p-4 text-sm text-ink-soft">
        <p>
          <PowerLaw result={result} />
        </p>
        <InfoTip term="powerLaw" />
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Growth is measured from {from}. Your multiple is on everything you paid, fees included.
        {anyRange ? ' A range means liquidation preferences decide where in it you land.' : ''} Hypothetical, not a forecast.
      </p>
    </section>
  )
}

/**
 * The power law in the user's own numbers: how many failed cheques like this
 * one a single win pays back. Counted from the low end of any range, so it
 * never promises more than the deal can deliver.
 */
export function PowerLaw({ result }: { result: Endings }) {
  const grows100 = result.rows.find((r) => r.kind === 'grows100')?.outcome
  const grows10 = result.rows.find((r) => r.kind === 'grows10')?.outcome
  if (!grows100 || !grows10) return null
  const m100 = grows100.feesLow.netMultiple
  const m10 = grows10.feesLow.netMultiple
  const cheques = (n: number) => `${n} other cheque${n === 1 ? '' : 's'}`

  const first =
    result.covers.grows100 > 0
      ? `One company that grows 100× returns ${multiple(m100)} what you put in: enough to cover ${cheques(result.covers.grows100)} like this one that fail.`
      : `Even a company that grows 100× returns only ${multiple(m100)} what you put in here, not enough to cover another failed cheque.`
  const second =
    m10 < 1
      ? 'A company that grows 10× does not even return this cheque, once dilution, preferences and fees are paid.'
      : result.covers.grows10 === 0
        ? 'A company that grows 10× only gets this cheque back, and covers no other.'
        : `A company that grows 10× covers ${cheques(result.covers.grows10)}.`
  return (
    <>
      <span className="font-medium text-ink">{first}</span> {second}
    </>
  )
}
