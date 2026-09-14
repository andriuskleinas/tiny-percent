import { useEffect, useReducer } from 'react'
import type { Scenario } from './engine/types'
import { appReducer, initialAppState } from './state/app'
import { STARTING_POINT } from './state/presets'
import { encodeScenario, scenarioFromLocation } from './state/url'
import { ErrorBoundary, ErrorNotice } from './ui/ErrorNotice'
import { CurrencyContext } from './ui/currency'
import { safeRun } from './ui/safeRun'
import { EntryPanel } from './ui/panels/EntryPanel'
import { ExitPanel } from './ui/panels/ExitPanel'
import { RoundsPanel } from './ui/panels/RoundsPanel'
import { CalculatorToolbar } from './ui/panels/CalculatorToolbar'
import { SummaryBar, SummaryPanel } from './ui/panels/SummaryPanel'

/**
 * A shared link wins over the default. It is checked for being runnable as well
 * as well-formed, so a link carrying a structurally valid but impossible deal
 * falls back rather than opening onto an error.
 */
function initialScenario(): Scenario {
  const shared = scenarioFromLocation(window.location.hash)
  return shared && safeRun(shared).run ? shared : STARTING_POINT
}

export default function App() {
  const [{ scenario, workable, run, error }, dispatch] = useReducer(
    appReducer,
    undefined,
    () => initialAppState(initialScenario()),
  )

  // Keep the address bar holding the current scenario, without filling the back
  // button with an entry for every keystroke.
  useEffect(() => {
    window.history.replaceState(null, '', `#s=${encodeScenario(scenario)}`)
  }, [scenario])

  const entry = scenario.rounds[0]
  // Rounds run in date order, so the entry's result is found by id, not position.
  const entryState = run.rounds.find((r) => r.round.id === entry?.id)

  return (
    <ErrorBoundary>
      <CurrencyContext.Provider value={scenario.currency}>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-10 sm:px-6 lg:pb-24">
          <header className="mb-6 max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Calculate your investment</h1>
            <p className="mt-3 text-ink-soft">
              Start with your initial investment and add future funding rounds to see how your ownership changes
              over time, and what it could be worth at an exit. Free, and nothing you type leaves your browser.
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
              <div className="sticky top-6">
                <SummaryPanel scenario={scenario} run={run} />
              </div>
            </aside>
          </div>

          <footer className="mt-12 border-t border-rule pt-6 text-xs text-ink-faint">
            <p className="max-w-prose">
              This calculator is provided for educational and informational purposes only. Results are hypothetical
              and depend on the assumptions entered. It does not constitute investment, legal, tax or financial
              advice. Actual investment outcomes may differ significantly.
            </p>
            <p className="mt-3 max-w-prose">
              Modelled from the angel&rsquo;s side only: instruments are priced at each round&rsquo;s valuation, and
              other holders&rsquo; terms beyond a 1&times; non-participating preference are not modelled. A shared
              link carries the whole calculation in its address, so share it as you would the numbers themselves.
            </p>
          </footer>
        </main>
        <SummaryBar scenario={scenario} run={run} />
      </CurrencyContext.Provider>
    </ErrorBoundary>
  )
}
