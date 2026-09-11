import type { ScenarioResult } from '../engine/scenario'
import type { Scenario } from '../engine/types'
import { safeRun } from '../ui/safeRun'
import { reducer } from './reducer'
import type { Action } from './reducer'

/**
 * The scenario reducer decides what the user typed. This one decides what can be
 * shown, which is not always the same thing.
 *
 * The engine throws by design on inputs with no answer, such as an option pool
 * at or above the pre-money share. When that happens the typed scenario is kept
 * so every field stays editable, while the last workable one keeps the figures
 * and charts on screen. Doing it here rather than in an effect means the engine
 * runs once per change and there is no cascading render.
 */
export interface AppState {
  /** What the user typed. Drives every input. */
  scenario: Scenario
  /** The last scenario that ran. Drives anything that re-runs the engine. */
  workable: Scenario
  /** Result of `workable`. */
  run: ScenarioResult
  error: Error | undefined
}

/** The scenario passed here must be runnable; callers check with `safeRun` first. */
export function initialAppState(scenario: Scenario): AppState {
  const { run, error } = safeRun(scenario)
  if (!run) throw error ?? new Error('The opening scenario cannot be calculated.')
  return { scenario, workable: scenario, run, error: undefined }
}

export function appReducer(state: AppState, action: Action): AppState {
  const scenario = reducer(state.scenario, action)
  if (scenario === state.scenario) return state
  const { run, error } = safeRun(scenario)
  return run
    ? { scenario, workable: scenario, run, error: undefined }
    : { ...state, scenario, error }
}
