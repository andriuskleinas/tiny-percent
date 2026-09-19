import { useEffect, useMemo, useState } from 'react'
import { trackOnce } from '../analytics/track'
import { strategyPaths } from '../engine/paths'
import type { AppState } from '../state/app'
import type { Action } from '../state/reducer'
import { ErrorNotice } from './ErrorNotice'
import { FollowOnChart } from './charts/FollowOnChart'
import { ReturnCurveChart } from './charts/ReturnCurveChart'
import { CurrencyContext } from './currency'
import { DilutionTable } from './panels/DilutionTable'
import { EndingsPanel } from './panels/EndingsPanel'
import { EntryPanel } from './panels/EntryPanel'
import { ExitCard } from './panels/ExitCard'
import { RoundsPanel } from './panels/RoundsPanel'
import { SummaryBar, SummaryPanel } from './panels/SummaryPanel'
import { ShareButton } from './ShareButton'

/**
 * The calculator section: your cheque and the rounds after it on the left, the
 * exit and the summary it drives on the right, and the three follow-on paths
 * drawn across the full width underneath.
 */
export function Calculator({ state, dispatch }: { state: AppState; dispatch: (action: Action) => void }) {
  const { scenario, workable, run, error } = state

  useEffect(() => {
    const section = document.getElementById('calculator')
    if (!section || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      trackOnce({ name: 'calculator_viewed' })
      observer.disconnect()
    })
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // The three versions of the deal behind the follow-on chart. Run from the last
  // workable scenario, so a half-typed round never blanks the chart.
  const paths = useMemo(() => {
    try {
      return strategyPaths(workable)
    } catch {
      return undefined
    }
  }, [workable])

  const [pendingIds, setPending] = useState<ReadonlySet<string>>(() => new Set())
  const pending = new Set([...pendingIds].filter((id) => scenario.rounds.some((r) => r.id === id)))
  const onAdded = (id: string) => setPending((was) => new Set(was).add(id))
  const onDecided = (id: string) =>
    setPending((was) => {
      if (!was.has(id)) return was
      const next = new Set(was)
      next.delete(id)
      return next
    })

  const entry = scenario.rounds[0]
  // Rounds run in date order, so the entry's result is found by id, not position.
  const entryState = run.rounds.find((r) => r.round.id === entry?.id)

  return (
    <CurrencyContext.Provider value={scenario.currency}>
      <section id="calculator" aria-labelledby="calculator-title" className="scroll-mt-14 border-t border-rule bg-sunk/40">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6">
          <header className="mb-8 max-w-3xl">
            <h2 id="calculator-title" className="text-3xl font-semibold tracking-tight text-ink outline-none sm:text-4xl">
              Run your own numbers
            </h2>
            <p className="mt-3 text-ink-soft">
              Enter your first cheque, add the rounds the company raises, and decide at each one whether you follow on.
              Nothing you type leaves your browser.
            </p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex min-w-0 flex-col gap-6">
              {error ? <ErrorNotice message={error.message} /> : null}
              {entry ? <EntryPanel
                  round={entry}
                  currency={scenario.currency}
                  state={entryState}
                  status={error ? undefined : run.entry}
                  converted={error ? undefined : run.rounds.find((r) => r.conversion)}
                  dispatch={dispatch}
                /> : null}
              <RoundsPanel
                rounds={scenario.rounds.slice(1)}
                names={scenario.rounds.map((r) => r.label)}
                states={run.rounds}
                pending={pending}
                onAdded={onAdded}
                onDecided={onDecided}
                dispatch={dispatch}
              />
            </div>
            <aside aria-label="Exit and summary">
              <div className="flex flex-col gap-4 lg:sticky lg:top-20">
                <ExitCard scenario={scenario} dispatch={dispatch} />
                <SummaryPanel scenario={scenario} run={run} />
                <ShareButton scenario={scenario} />
              </div>
            </aside>
          </div>

          {/* From the last workable scenario, like everything below, so a half-typed field never blanks it. */}
          <div className="mt-12 empty:hidden">
            <EndingsPanel scenario={workable} run={run} dispatch={dispatch} />
          </div>

          {workable.rounds.length > 1 ? (
            <>
              {paths ? (
                <div className="mt-12">
                  <FollowOnChart paths={paths} pending={pending} />
                </div>
              ) : null}
              <section aria-labelledby="stake-table-title" className="mt-6 rounded-2xl border border-rule bg-surface shadow-card px-5 py-5 sm:px-8 sm:py-6">
                <h3 id="stake-table-title" className="text-lg font-semibold tracking-tight text-ink">
                  Your stake, round by round
                </h3>
                <p className="mt-1 text-sm text-ink-soft">Each round you entered, with your cheque, your ownership and what your stake is worth, ending with a sale at the exit valuation you chose.</p>
                <div className="mt-4">
                  <DilutionTable
                    states={run.rounds}
                    exit={
                      workable.exit.valueCents > 0 && run.totalInvestedCents > 0
                        ? {
                            valueCents: workable.exit.valueCents,
                            date: workable.exit.date,
                            finalOwnership: run.finalOwnership,
                            grossLowCents: run.exit.lowCents,
                            grossHighCents: run.exit.highCents,
                            netLowCents: run.feesLow.netCents,
                            netHighCents: run.feesHigh.netCents,
                            multipleLow: run.feesLow.netMultiple,
                            multipleHigh: run.feesHigh.netMultiple,
                            carryPercent: workable.fees.carry.percent,
                            preferences: run.exit.regime !== 'clean',
                          }
                        : undefined
                    }
                  />
                </div>
              </section>
            </>
          ) : workable.exit.valueCents > 0 && run.totalInvestedCents > 0 ? (
            <div className="mt-12">
              <ReturnCurveChart scenario={workable} run={run} dispatch={dispatch} />
            </div>
          ) : null}
        </div>
        <SummaryBar scenario={scenario} run={run} />
      </section>
    </CurrencyContext.Provider>
  )
}
