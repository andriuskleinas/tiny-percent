import { useEffect, useState, useSyncExternalStore } from 'react'
import { useMoney } from '../currency'
import type { ScenarioResult } from '../../engine/scenario'
import type { Scenario } from '../../engine/types'
import { InfoTip } from '../controls'
import { multiple, ownership, percent, roundName } from '../format'

/**
 * Every figure the calculator changes, in one card: the cheques, the ownership
 * they end in, and what an exit returns after carry. It sits under the exit
 * slider on a wide screen, and a one-line version is pinned to a phone's
 * bottom edge while the calculator is in view.
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
  const { money, compactMoney } = useMoney()
  const { entry, initialCents, followOnCents, range } = figures(scenario, run)
  const ready = initialCents > 0 && (entry?.postMoneyCents ?? 0) > 0
  const exitCents = scenario.exit.valueCents
  const { feesLow: low, feesHigh: high } = run
  const charged = low.carryCents > 0 || high.carryCents > 0 || low.managementFeeCents > 0 || low.entryFeeCents > 0

  const rows: Array<[string, string]> = ready
    ? [
        [`Initial investment${entry ? ` (${roundName(entry.round)})` : ''}`, money(initialCents)],
        ['Initial ownership', ownership(entry?.ownershipAfter ?? 0)],
        ['Follow-on investments', money(followOnCents)],
        ['Total invested', money(run.totalInvestedCents)],
        ['Final ownership', ownership(run.finalOwnership)],
      ]
    : []

  return (
    <section aria-labelledby="summary-title" className="rounded-2xl border border-rule bg-surface shadow-card">
      <h2 id="summary-title" className="border-b border-rule px-5 py-3 text-base font-semibold text-ink">
        Your investment summary
      </h2>
      {ready ? (
        <div aria-live="polite" className="px-5 py-4">
          <dl className="flex flex-col gap-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="min-w-0 truncate text-ink-faint">{label}</dt>
                <dd className="shrink-0 whitespace-nowrap text-right font-mono tabular-nums text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {exitCents > 0 ? (
            <div className="mt-4 border-t border-rule pt-4">
              <p className="whitespace-nowrap text-xs text-ink-faint">If the company sells for {compactMoney(exitCents)}</p>
              <dl className="mt-2 flex flex-col gap-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="min-w-0 truncate text-ink-faint">Gross proceeds</dt>
                  <dd className="shrink-0 whitespace-nowrap text-right font-mono tabular-nums text-ink">{range(money(run.exit.lowCents), money(run.exit.highCents))}</dd>
                </div>
                {charged ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="min-w-0 truncate text-ink-faint">
                      {low.entryFeeCents > 0 || low.managementFeeCents > 0
                        ? 'Carry and fees'
                        : `Carry (${percent(scenario.fees.carry.percent, 0)})`}
                    </dt>
                    <dd className="shrink-0 whitespace-nowrap text-right font-mono tabular-nums text-dilute">
                      {low.dragCents === high.dragCents || !run.exit.uncertain
                        ? `−${money(high.dragCents)}`
                        : low.dragCents === 0
                          ? `up to −${money(high.dragCents)}`
                          : `−${money(low.dragCents)} – ${money(high.dragCents)}`}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 whitespace-nowrap text-ink-faint">Net proceeds</dt>
                  <dd
                    className={`whitespace-nowrap text-right font-mono font-semibold tracking-tight tabular-nums text-gain ${
                      run.exit.uncertain && low.netCents !== high.netCents ? 'text-base' : 'text-2xl'
                    }`}
                  >
                    {range(money(low.netCents), money(high.netCents))}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="flex items-center gap-1.5 whitespace-nowrap text-ink-faint">
                    Multiple <InfoTip term="moic" />
                  </dt>
                  <dd className="shrink-0 whitespace-nowrap text-right font-mono tabular-nums text-ink">{range(multiple(low.netMultiple), multiple(high.netMultiple))}</dd>
                </div>
              </dl>
              {run.exit.regime === 'clean' ? null : (
                <p className="mt-3 flex gap-1.5 rounded-lg border-l-2 border-dilute bg-dilute/[0.06] py-2 pl-2.5 pr-2 text-xs text-ink-soft">
                  <span>
                    {run.exit.regime === 'downside'
                      ? `At or below the ${compactMoney(scenario.exit.totalRaisedCents)} the company raised, liquidation preferences pay later investors first, so you may receive less.`
                      : `Close to the ${compactMoney(scenario.exit.totalRaisedCents)} the company raised, liquidation preferences decide where in this range you land.`}
                  </span>
                  <InfoTip term="preferences" />
                </p>
              )}
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

const noObserver = () => typeof IntersectionObserver === 'undefined'
const subscribeNever = () => () => {}

/**
 * Whether the calculator section is on screen. The prerendered HTML and the
 * first client render both say "not visible", so hydration matches. Without
 * IntersectionObserver (old browsers, the test DOM) it counts as visible.
 */
function useOnScreen(id: string): boolean {
  const unsupported = useSyncExternalStore(subscribeNever, noObserver, () => false)
  const [intersecting, setIntersecting] = useState(false)
  useEffect(() => {
    const target = document.getElementById(id)
    if (!target || noObserver()) return undefined
    const observer = new IntersectionObserver(([entry]) => setIntersecting(entry?.isIntersecting ?? false))
    observer.observe(target)
    return () => observer.disconnect()
  }, [id])
  return unsupported || intersecting
}

/** The phone version: one line, in reach while you work in the calculator and out of the way elsewhere. */
export function SummaryBar({ scenario, run }: { scenario: Scenario; run: ScenarioResult }) {
  const { money, compactMoney } = useMoney()
  const onScreen = useOnScreen('calculator')
  const { entry, initialCents, range } = figures(scenario, run)
  if (!onScreen || initialCents <= 0 || (entry?.postMoneyCents ?? 0) <= 0) return null
  const exitCents = scenario.exit.valueCents
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule-strong bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 font-mono text-xs tabular-nums text-ink-soft">
        <span>
          You own <strong className="text-ink">{ownership(run.finalOwnership)}</strong>
        </span>
        {exitCents > 0 ? (
          <span>
            <strong className="text-gain">{range(money(run.feesLow.netCents), money(run.feesHigh.netCents))}</strong> at{' '}
            {compactMoney(exitCents)} · {range(multiple(run.feesLow.netMultiple), multiple(run.feesHigh.netMultiple))}
          </span>
        ) : null}
      </p>
    </div>
  )
}
