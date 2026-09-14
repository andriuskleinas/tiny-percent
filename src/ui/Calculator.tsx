import { useEffect } from 'react'
import { trackOnce } from '../analytics/track'
import type { AppState } from '../state/app'
import type { Action } from '../state/reducer'
import { ErrorNotice } from './ErrorNotice'
import { CurrencyContext } from './currency'
import { CalculatorToolbar } from './panels/CalculatorToolbar'
import { EntryPanel } from './panels/EntryPanel'
import { ExitPanel } from './panels/ExitPanel'
import { RoundsPanel } from './panels/RoundsPanel'
import { SummaryBar, SummaryPanel } from './panels/SummaryPanel'

/** The calculator section: everything that reads or changes the scenario. */
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
  const entry = scenario.rounds[0]
  // Rounds run in date order, so the entry's result is found by id, not position.
  const entryState = run.rounds.find((r) => r.round.id === entry?.id)

  return (
    <CurrencyContext.Provider value={scenario.currency}>
      <section id="calculator" aria-labelledby="calculator-title" className="scroll-mt-14 border-t border-rule bg-sunk/40">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6">
          <header className="mb-6 max-w-3xl">
            <h2 id="calculator-title" className="text-3xl font-semibold tracking-tight text-ink outline-none sm:text-4xl">
              Calculate your investment
            </h2>
            <p className="mt-3 text-ink-soft">
              Start with your initial investment and add future funding rounds to see how your ownership changes over
              time. Nothing you type leaves your browser.
            </p>
          </header>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-6">
              <CalculatorToolbar currency={scenario.currency} dispatch={dispatch} />
              {error ? <ErrorNotice message={error.message} /> : null}
              {entry ? <EntryPanel round={entry} currency={scenario.currency} state={entryState} dispatch={dispatch} /> : null}
              <RoundsPanel rounds={scenario.rounds.slice(1)} states={run.rounds} dispatch={dispatch} />
              <ExitPanel scenario={scenario} workable={workable} run={run} dispatch={dispatch} />
            </div>
            <aside className="hidden lg:block">
              <div className="sticky top-20">
                <SummaryPanel scenario={scenario} run={run} />
              </div>
            </aside>
          </div>
        </div>
        <SummaryBar scenario={scenario} run={run} />
      </section>
    </CurrencyContext.Provider>
  )
}
