import { runScenario } from '../engine/scenario'
import type { ScenarioResult } from '../engine/scenario'
import type { Scenario } from '../engine/types'

/**
 * The engine throws by design on inputs that have no answer — an option pool at
 * or above the pre-money share, for instance. Those throws must never reach
 * React's render, because a throw there blanks the whole page and strands the
 * user with no way to correct the figure they just typed.
 *
 * Everything in the interface goes through here.
 */
export interface SafeRun {
  run: ScenarioResult | undefined
  error: Error | undefined
}

export function safeRun(scenario: Scenario): SafeRun {
  try {
    return { run: runScenario(scenario), error: undefined }
  } catch (thrown) {
    return { run: undefined, error: thrown as Error }
  }
}

/**
 * Keeps the last workable result on screen while the current one is broken, so
 * the figures stay visible and every field stays editable.
 */
export function runWithFallback(
  scenario: Scenario,
  previous: { scenario: Scenario; run: ScenarioResult } | null,
): { run: ScenarioResult | undefined; scenario: Scenario; error: Error | undefined } {
  const attempt = safeRun(scenario)
  if (attempt.run) return { run: attempt.run, scenario, error: undefined }
  return {
    run: previous?.run,
    scenario: previous?.scenario ?? scenario,
    error: attempt.error,
  }
}
