// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useReducer } from 'react'
import { runScenario } from '../engine/scenario'
import type { Scenario } from '../engine/types'
import { SAFE_AT_A_CAP, WORKED_EXAMPLE } from '../state/presets'
import { reducer } from '../state/reducer'
import { CurrencyContext } from './currency'
import { ExitPanel } from './panels/ExitPanel'

/**
 * Regression guard. Editing the entry fee percentage used to send
 * `rule: 'percent'` with it, which silently deleted a fixed minimum fee and
 * changed every net figure on the page without saying so.
 */

afterEach(cleanup)

function mount(initial: Scenario) {
  const seen: { current: Scenario } = { current: initial }
  function Harness() {
    const [scenario, dispatch] = useReducer(reducer, initial)
    useEffect(() => {
      seen.current = scenario
    }, [scenario])
    return (
      <CurrencyContext.Provider value={scenario.currency}>
        <ExitPanel scenario={scenario} run={runScenario(scenario)} dispatch={dispatch} />
      </CurrencyContext.Provider>
    )
  }
  render(<Harness />)
  return seen
}

describe('editing the entry fee never discards terms you did not touch', () => {
  it('keeps a fixed minimum when the percentage is edited', () => {
    const state = mount(SAFE_AT_A_CAP)
    expect(state.current.fees.entry).toMatchObject({ rule: 'greater_of', fixedCents: 250_000 })

    fireEvent.change(screen.getByLabelText('Entry fee percentage'), { target: { value: '3' } })

    expect(state.current.fees.entry.percent).toBeCloseTo(0.03, 12)
    expect(state.current.fees.entry.rule).toBe('greater_of')
    expect(state.current.fees.entry.fixedCents).toBe(250_000)
  })

  it('leaves the fees exactly as they were when the same value is re-entered', () => {
    const state = mount(SAFE_AT_A_CAP)
    const before = runScenario(state.current).feesLow

    fireEvent.change(screen.getByLabelText('Entry fee percentage'), { target: { value: '2' } })

    expect(state.current.fees.entry).toEqual(SAFE_AT_A_CAP.fees.entry)
    expect(runScenario(state.current).feesLow).toEqual(before)
  })
})

describe('the entry fee basis can be chosen, and shows only the fields it uses', () => {
  it('shows both amounts when the fee is the greater of the two', () => {
    mount(SAFE_AT_A_CAP)
    expect(screen.getByLabelText('Entry fee percentage')).toBeTruthy()
    expect(screen.getByLabelText('Fixed entry fee')).toBeTruthy()
  })

  it('edits the fixed minimum in major units', () => {
    const state = mount(SAFE_AT_A_CAP)
    fireEvent.change(screen.getByLabelText('Fixed entry fee'), { target: { value: '4000' } })
    expect(state.current.fees.entry.fixedCents).toBe(400_000)
    expect(state.current.fees.entry.rule).toBe('greater_of')
  })

  it('hides the fixed amount for a percentage-only fee', () => {
    const state = mount(SAFE_AT_A_CAP)
    fireEvent.change(screen.getByLabelText('Entry fee basis'), { target: { value: 'percent' } })
    expect(state.current.fees.entry.rule).toBe('percent')
    expect(screen.queryByLabelText('Fixed entry fee')).toBeNull()
    expect(screen.getByLabelText('Entry fee percentage')).toBeTruthy()
  })

  it('hides the percentage for a fixed fee', () => {
    mount(SAFE_AT_A_CAP)
    fireEvent.change(screen.getByLabelText('Entry fee basis'), { target: { value: 'fixed' } })
    expect(screen.queryByLabelText('Entry fee percentage')).toBeNull()
    expect(screen.getByLabelText('Fixed entry fee')).toBeTruthy()
  })
})

describe('the management fee can be set on screen', () => {
  it('starts off, with no fields to fill', () => {
    const state = mount(WORKED_EXAMPLE)
    expect(state.current.fees.management).toBeUndefined()
    expect(screen.queryByLabelText('Management fee per year')).toBeNull()
  })

  it('turns on with sensible defaults and reveals its fields', () => {
    const state = mount(WORKED_EXAMPLE)
    fireEvent.change(screen.getByLabelText('Management fee'), { target: { value: 'invoiced' } })
    expect(state.current.fees.management).toEqual({ annualPercent: 0.02, years: 10, source: 'invoiced' })
    expect(screen.getByLabelText('Management fee per year')).toBeTruthy()
    expect(screen.getByLabelText('Charged for how many years')).toBeTruthy()
  })

  it('edits its rate and term without losing where it is charged', () => {
    const state = mount(WORKED_EXAMPLE)
    fireEvent.change(screen.getByLabelText('Management fee'), { target: { value: 'capital' } })
    fireEvent.change(screen.getByLabelText('Management fee per year'), { target: { value: '1.5' } })
    fireEvent.change(screen.getByLabelText('Charged for how many years'), { target: { value: '7' } })
    expect(state.current.fees.management).toEqual({ annualPercent: 0.015, years: 7, source: 'capital' })
  })

  it('turns off again', () => {
    const state = mount(WORKED_EXAMPLE)
    fireEvent.change(screen.getByLabelText('Management fee'), { target: { value: 'invoiced' } })
    fireEvent.change(screen.getByLabelText('Management fee'), { target: { value: 'none' } })
    expect(state.current.fees.management).toBeUndefined()
  })

  it('actually reaches the result', () => {
    const state = mount(WORKED_EXAMPLE)
    const before = runScenario(state.current).feesLow.outlayCents
    fireEvent.change(screen.getByLabelText('Management fee'), { target: { value: 'invoiced' } })
    // 2% a year for ten years on the $50,000 cheque, invoiced on top.
    expect(runScenario(state.current).feesLow.outlayCents).toBe(before + 1_000_000)
  })
})
