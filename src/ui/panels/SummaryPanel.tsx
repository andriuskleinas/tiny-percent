import { useMoney } from '../currency'
import type { ScenarioResult } from '../../engine/scenario'
import type { Scenario } from '../../engine/types'
import { InfoTip } from '../controls'
import { multiple, ownership } from '../format'

/**
 * The handful of numbers someone should leave with even if they ignore every
 * detail: kept beside the calculator on a wide screen, and pinned to the bottom
 * of a narrow one.
 */

function figures(scenario: Scenario, run: ScenarioResult) {
  const entryId = scenario.rounds[0]?.id
  const entry = run.rounds.find((r) => r.round.id === entryId)
  const initialCents = entry?.investedCents ?? 0
  const uncertain = run.exit.uncertain
  const range = (low: string, high: string) => (uncertain && low !== high ? `${low} – ${high}` : high)
  return { entry, initialCents, followOnCents: run.totalInvestedCents - initialCents, range }
}

export function SummaryPanel({ scenario, run }: { scenario: Scenario; run: ScenarioResult }) {
  const { money } = useMoney()
  const { entry, initialCents, followOnCents, range } = figures(scenario, run)
  const ready = initialCents > 0 && (entry?.postMoneyCents ?? 0) > 0
  const exitCents = scenario.exit.valueCents

  const rows: Array<[string, string, 'moic' | undefined]> = ready
    ? [
        ['Initial investment', money(initialCents), undefined],
        ['Initial ownership', ownership(entry?.ownershipAfter ?? 0), undefined],
        ['Final ownership', ownership(run.finalOwnership), undefined],
        ['Follow-on investments', money(followOnCents), undefined],
        ['Total invested', money(run.totalInvestedCents), undefined],
      ]
    : []

  return (
    <section aria-labelledby="summary-title" className="border border-rule bg-surface">
      <h2 id="summary-title" className="border-b border-rule px-5 py-3 text-base font-semibold text-ink">
        Your investment
      </h2>
      {ready ? (
        <div className="px-5 py-4">
          <dl className="flex flex-col gap-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-ink-faint">{label}</dt>
                <dd className="font-mono tabular-nums text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {exitCents > 0 ? (
            <div className="mt-4 border-t border-rule pt-4">
              <p className="text-xs text-ink-faint">Potential proceeds at a {money(exitCents)} exit</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums text-gain">
                {range(money(run.exit.lowCents), money(run.exit.highCents))}
              </p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-sm tabular-nums text-ink">
                {range(multiple(run.feesLow.netMultiple), multiple(run.feesHigh.netMultiple))} MOIC
                <InfoTip term="moic" />
              </p>
              <p className="mt-3 text-[11px] leading-snug text-ink-faint">Hypothetical, not a forecast.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-ink-soft">Your numbers appear here once you enter an investment and a valuation.</p>
      )}
    </section>
  )
}

/** The phone version: one line, always in reach. */
export function SummaryBar({ scenario, run }: { scenario: Scenario; run: ScenarioResult }) {
  const { money, compactMoney } = useMoney()
  const { entry, initialCents, range } = figures(scenario, run)
  if (initialCents <= 0 || (entry?.postMoneyCents ?? 0) <= 0) return null
  const exitCents = scenario.exit.valueCents
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule-strong bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 font-mono text-xs tabular-nums text-ink-soft">
        <span>
          You own <strong className="text-ink">{ownership(run.finalOwnership)}</strong>
        </span>
        {exitCents > 0 ? (
          <span>
            <strong className="text-gain">{range(money(run.exit.lowCents), money(run.exit.highCents))}</strong> at{' '}
            {compactMoney(exitCents)} · {range(multiple(run.feesLow.netMultiple), multiple(run.feesHigh.netMultiple))}
          </span>
        ) : null}
      </p>
    </div>
  )
}
