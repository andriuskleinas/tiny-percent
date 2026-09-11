import { useMemo, useReducer, useRef } from 'react'
import type { ScenarioResult } from './engine/scenario'
import type { Scenario } from './engine/types'
import { runWithFallback } from './ui/safeRun'
import { reducer } from './state/reducer'
import { WORKED_EXAMPLE } from './state/presets'
import { ErrorBoundary, ErrorNotice } from './ui/ErrorNotice'
import { EntryPanel } from './ui/panels/EntryPanel'
import { ExitPanel } from './ui/panels/ExitPanel'
import { FollowOnPanel } from './ui/panels/FollowOnPanel'
import { RoundsPanel } from './ui/panels/RoundsPanel'
import { SummaryStrip } from './ui/panels/SummaryStrip'

export default function App() {
  const [scenario, dispatch] = useReducer(reducer, WORKED_EXAMPLE)

  // An impossible input must not blank the page. Keep the last workable result
  // on screen, say what is wrong, and leave every field editable so it can be
  // corrected.
  const lastGood = useRef<{ scenario: Scenario; run: ScenarioResult } | null>(null)
  const { run, scenario: workable, error } = useMemo(() => {
    const outcome = runWithFallback(scenario, lastGood.current)
    if (outcome.run && !outcome.error) lastGood.current = { scenario, run: outcome.run }
    return outcome
  }, [scenario])

  if (!run) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <ErrorNotice message={error?.message ?? 'This scenario cannot be calculated.'} />
      </main>
    )
  }

  const entryRound = run.rounds.find((s) => s.conversion)
  const conversion = entryRound?.conversion

  return (
    <ErrorBoundary>
      <SummaryStrip run={run} />
      <main className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-6">
        <header className="mb-10">
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
          {error ? <ErrorNotice message={error.message} /> : null}
          <EntryPanel
            entry={scenario.entry}
            conversion={conversion}
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
            not modelled, and each would make a bad exit worse than shown here.
          </p>
        </footer>
      </main>
    </ErrorBoundary>
  )
}
