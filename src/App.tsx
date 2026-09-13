import { useEffect, useReducer } from 'react'
import type { Scenario } from './engine/types'
import { appReducer, initialAppState } from './state/app'
import { WORKED_EXAMPLE } from './state/presets'
import { encodeScenario, scenarioFromLocation } from './state/url'
import { ErrorBoundary, ErrorNotice } from './ui/ErrorNotice'
import { CurrencyContext } from './ui/currency'
import { safeRun } from './ui/safeRun'
import { EntryPanel } from './ui/panels/EntryPanel'
import { ExitPanel } from './ui/panels/ExitPanel'
import { FollowOnPanel } from './ui/panels/FollowOnPanel'
import { RoundsPanel } from './ui/panels/RoundsPanel'
import { ScenarioBar } from './ui/panels/ScenarioBar'
import { SummaryStrip } from './ui/panels/SummaryStrip'

/**
 * A shared link wins over the default. It is checked for being runnable as well
 * as well-formed, so a link carrying a structurally valid but impossible deal
 * falls back rather than opening onto an error.
 */
function initialScenario(): Scenario {
  const shared = scenarioFromLocation(window.location.hash)
  return shared && safeRun(shared).run ? shared : WORKED_EXAMPLE
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

  const entryRound = run.rounds.find((s) => s.conversion)

  return (
    <ErrorBoundary>
      <CurrencyContext.Provider value={scenario.currency}>
      <SummaryStrip run={run} />
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-6">
        <header className="mb-8">
          <h1 className="text-3xl font-medium tracking-tight text-ink sm:text-4xl">
            Angel Dilution Calculator
          </h1>
          <p className="mt-3 max-w-prose text-ink-soft">
            What your cheque buys, what the next rounds take back, and what survives the
            syndicate&rsquo;s carry. Every figure is yours to change. It opens on a worked
            example so you can see what it does before you type anything.
          </p>
        </header>

        <div className="flex flex-col gap-8">
          <ScenarioBar
            scenario={scenario}
            onLoad={(next) => dispatch({ type: 'scenario:replace', scenario: next })}
          />
          {error ? <ErrorNotice message={error.message} /> : null}
          <EntryPanel
            entry={scenario.entry}
            currency={scenario.currency}
            conversion={entryRound?.conversion}
            stakeValueCents={entryRound?.stakeValueCents ?? 0}
            dispatch={dispatch}
          />
          <RoundsPanel rounds={scenario.rounds} states={run.rounds} dispatch={dispatch} />
          <FollowOnPanel scenario={workable} run={run} />
          <ExitPanel scenario={scenario} run={run} dispatch={dispatch} />
        </div>

        <footer className="mt-12 border-t border-rule pt-6 text-xs text-ink-faint">
          <p className="max-w-prose">
            Modelled from the angel&rsquo;s side only. Other holders&rsquo; convertibles,
            structured preferences beyond 1&times; non-participating, and anti-dilution are
            not modelled, and each would make a bad exit worse than shown here. Saved
            scenarios stay in this browser; a shared link carries the whole deal in its
            address, so treat it the way you would treat the numbers themselves.
          </p>
        </footer>
      </main>
      </CurrencyContext.Provider>
    </ErrorBoundary>
  )
}
