import { describe, expect, it } from 'vitest'
import { WORKED_EXAMPLE } from '../state/presets'
import { appReducer, initialAppState } from '../state/app'
import { runScenario } from '../engine/scenario'
import { safeRun } from './safeRun'

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
    const start = initialAppState(WORKED_EXAMPLE)
    const broken = appReducer(start, {
      type: 'round:set',
      id: 'b',
      patch: { newOptionPool: 0.9 },
    })
    expect(broken.run).toBe(start.run)
    expect(broken.error?.message).toMatch(/option pool/i)
  })

  it('still keeps what the user typed, so the field can be corrected', () => {
    const start = initialAppState(WORKED_EXAMPLE)
    const broken = appReducer(start, {
      type: 'round:set',
      id: 'b',
      patch: { newOptionPool: 0.9 },
    })
    expect(broken.scenario.rounds[1]?.newOptionPool).toBe(0.9)
  })

  it('hands the derived panels the last workable scenario, never the broken one', () => {
    // The follow-on panel re-runs the scenario with decisions swapped, so giving
    // it the broken one would throw again outside any guard.
    const start = initialAppState(WORKED_EXAMPLE)
    const broken = appReducer(start, {
      type: 'round:set',
      id: 'b',
      patch: { newOptionPool: 0.9 },
    })
    expect(() => runScenario(broken.workable)).not.toThrow()
  })

  it('recovers the moment the figure is corrected', () => {
    const start = initialAppState(WORKED_EXAMPLE)
    const broken = appReducer(start, { type: 'round:set', id: 'b', patch: { newOptionPool: 0.9 } })
    const fixed = appReducer(broken, { type: 'round:set', id: 'b', patch: { newOptionPool: 0.1 } })
    expect(fixed.error).toBeUndefined()
    expect(fixed.run.finalOwnership).toBeCloseTo(0.0028, 12)
  })
})
