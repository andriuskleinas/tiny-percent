import { describe, expect, it } from 'vitest'
import { WORKED_EXAMPLE } from '../state/presets'
import { runScenario } from '../engine/scenario'
import { runWithFallback, safeRun } from './safeRun'

/**
 * Regression guard. Typing an impossible option pool used to blank the entire
 * page, because the engine's deliberate throw reached React's render.
 */

const impossible = {
  ...WORKED_EXAMPLE,
  rounds: WORKED_EXAMPLE.rounds.map((r, i) => (i === 1 ? { ...r, newOptionPool: 0.9 } : r)),
}

describe('the interface never lets an engine throw reach render', () => {
  it('confirms the engine really does throw on this input', () => {
    expect(() => runScenario(impossible)).toThrow(/option pool/i)
  })

  it('returns the error instead of throwing', () => {
    const { run, error } = safeRun(impossible)
    expect(run).toBeUndefined()
    expect(error?.message).toMatch(/option pool of 90/i)
  })

  it('passes a workable scenario straight through', () => {
    const { run, error } = safeRun(WORKED_EXAMPLE)
    expect(error).toBeUndefined()
    expect(run?.finalOwnership).toBeCloseTo(0.0032, 12)
  })

  it('keeps the last workable result on screen when the new one breaks', () => {
    const good = runScenario(WORKED_EXAMPLE)
    const fallback = runWithFallback(impossible, { scenario: WORKED_EXAMPLE, run: good })
    expect(fallback.run).toBe(good)
    expect(fallback.scenario).toBe(WORKED_EXAMPLE)
    expect(fallback.error?.message).toMatch(/option pool/i)
  })

  it('hands the derived panels the last workable scenario, never the broken one', () => {
    // The follow-on panel re-runs the scenario with decisions swapped, so giving
    // it the broken one would throw again outside any guard.
    const good = runScenario(WORKED_EXAMPLE)
    const { scenario } = runWithFallback(impossible, { scenario: WORKED_EXAMPLE, run: good })
    expect(() => runScenario(scenario)).not.toThrow()
  })

  it('has nothing to fall back to on the very first render', () => {
    const { run, error } = runWithFallback(impossible, null)
    expect(run).toBeUndefined()
    expect(error).toBeDefined()
  })
})
