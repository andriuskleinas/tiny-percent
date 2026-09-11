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
