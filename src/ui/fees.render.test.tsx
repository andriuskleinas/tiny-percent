// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useReducer } from 'react'
import { runScenario } from '../engine/scenario'
import type { Scenario } from '../engine/types'
import { SAFE_AT_A_CAP, WORKED_EXAMPLE } from '../state/presets'
import { reducer } from '../state/reducer'
import { CurrencyContext } from './currency'
import { EntryPanel } from './panels/EntryPanel'
import { ExitPanel } from './panels/ExitPanel'
import { RoundsPanel } from './panels/RoundsPanel'

/**
 * Regression guard. Editing the entry fee percentage used to send
 * `rule: 'percent'` with it, which silently deleted a fixed minimum fee and
 * changed every net figure on the page without saying so. The entry fee now
 * lives on each cheque, so both the entry panel and a follow-on round are
 * checked.
 */

afterEach(cleanup)

type Panel = 'entry' | 'rounds' | 'exit'

function mount(initial: Scenario, panel: Panel = 'exit') {
  const seen: { current: Scenario } = { current: initial }
  function Harness() {
    const [scenario, dispatch] = useReducer(reducer, initial)
    useEffect(() => {
      seen.current = scenario
    }, [scenario])
    const run = runScenario(scenario)
    const entry = scenario.rounds[0]
    return (
      <CurrencyContext.Provider value={scenario.currency}>
        {panel === 'entry' && entry ? <EntryPanel round={entry} currency={scenario.currency} state={run.rounds[0]} dispatch={dispatch} /> : null}
        {panel === 'rounds' ? <RoundsPanel rounds={scenario.rounds.slice(1)} states={run.rounds} dispatch={dispatch} /> : null}
        {panel === 'exit' ? <ExitPanel scenario={scenario} run={run} dispatch={dispatch} /> : null}
      </CurrencyContext.Provider>
    )
  }
  render(<Harness />)
  return seen
}

const entryFee = (s: Scenario) => s.rounds[0]?.participation?.entryFee
const seriesAFee = (s: Scenario) => s.rounds.find((r) => r.id === 'a')?.participation?.entryFee

describe('editing the entry fee never discards terms you did not touch', () => {
  it('keeps a fixed minimum when the percentage is edited', () => {
    const state = mount(SAFE_AT_A_CAP, 'entry')
    expect(entryFee(state.current)).toMatchObject({ rule: 'greater_of', fixedCents: 250_000 })

    fireEvent.change(screen.getByLabelText('Entry fee percentage'), { target: { value: '3' } })

    expect(entryFee(state.current)?.percent).toBeCloseTo(0.03, 12)
    expect(entryFee(state.current)?.rule).toBe('greater_of')
    expect(entryFee(state.current)?.fixedCents).toBe(250_000)
  })

  it('leaves the fees exactly as they were when the same value is re-entered', () => {
    const state = mount(SAFE_AT_A_CAP, 'entry')
    const before = runScenario(state.current).feesLow

    fireEvent.change(screen.getByLabelText('Entry fee percentage'), { target: { value: '2' } })

    expect(entryFee(state.current)).toEqual(entryFee(SAFE_AT_A_CAP))
    expect(runScenario(state.current).feesLow).toEqual(before)
  })

  it('keeps a follow-on cheque’s fixed minimum when its percentage is edited', () => {
    const state = mount(SAFE_AT_A_CAP, 'rounds')

    fireEvent.change(screen.getByLabelText('Entry fee percentage'), { target: { value: '3' } })

    expect(seriesAFee(state.current)).toEqual({ rule: 'greater_of', percent: 0.03, fixedCents: 250_000 })
  })
})

describe('the entry fee basis can be chosen, and shows only the fields it uses', () => {
  it('shows both amounts when the fee is the greater of the two', () => {
    mount(SAFE_AT_A_CAP, 'entry')
    expect(screen.getByLabelText('Entry fee percentage')).toBeTruthy()
    expect(screen.getByLabelText('Fixed entry fee')).toBeTruthy()
  })

  it('edits the fixed minimum in major units', () => {
    const state = mount(SAFE_AT_A_CAP, 'entry')
    fireEvent.change(screen.getByLabelText('Fixed entry fee'), { target: { value: '4000' } })
    expect(entryFee(state.current)?.fixedCents).toBe(400_000)
    expect(entryFee(state.current)?.rule).toBe('greater_of')
  })

  it('hides the fixed amount for a percentage-only fee', () => {
    const state = mount(SAFE_AT_A_CAP, 'entry')
    fireEvent.change(screen.getByLabelText('Entry fee basis'), { target: { value: 'percent' } })
    expect(entryFee(state.current)?.rule).toBe('percent')
    expect(screen.queryByLabelText('Fixed entry fee')).toBeNull()
    expect(screen.getByLabelText('Entry fee percentage')).toBeTruthy()
  })

  it('hides the percentage for a fixed fee', () => {
    mount(SAFE_AT_A_CAP, 'entry')
    fireEvent.change(screen.getByLabelText('Entry fee basis'), { target: { value: 'fixed' } })
    expect(screen.queryByLabelText('Entry fee percentage')).toBeNull()
    expect(screen.getByLabelText('Fixed entry fee')).toBeTruthy()
  })

  it('actually reaches the result', () => {
    const state = mount(WORKED_EXAMPLE, 'entry')
    fireEvent.change(screen.getByLabelText('Entry fee percentage'), { target: { value: '5' } })
    // 5% of the $50,000 cheque.
    expect(runScenario(state.current).feesLow.entryFeeCents).toBe(250_000)
  })
})

describe('carry can be edited', () => {
  it('changes the carry percentage', () => {
    const state = mount(WORKED_EXAMPLE)
    fireEvent.change(screen.getByLabelText('Carry'), { target: { value: '25' } })
    expect(state.current.fees.carry.percent).toBeCloseTo(0.25, 12)
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
    fireEvent.click(screen.getByRole('radio', { name: 'Charged' }))
    expect(state.current.fees.management).toEqual({ annualPercent: 0.02, years: 10 })
    expect(screen.getByLabelText('Management fee per year')).toBeTruthy()
    expect(screen.getByLabelText('Charged for how many years')).toBeTruthy()
  })

  it('edits its rate and term', () => {
    const state = mount(WORKED_EXAMPLE)
    fireEvent.click(screen.getByRole('radio', { name: 'Charged' }))
    fireEvent.change(screen.getByLabelText('Management fee per year'), { target: { value: '1.5' } })
    fireEvent.change(screen.getByLabelText('Charged for how many years'), { target: { value: '7' } })
    expect(state.current.fees.management).toEqual({ annualPercent: 0.015, years: 7 })
  })

  it('turns off again', () => {
    const state = mount(WORKED_EXAMPLE)
    fireEvent.click(screen.getByRole('radio', { name: 'Charged' }))
    fireEvent.click(screen.getByRole('radio', { name: 'None' }))
    expect(state.current.fees.management).toBeUndefined()
  })

  it('actually reaches the result', () => {
    const state = mount(WORKED_EXAMPLE)
    fireEvent.click(screen.getByRole('radio', { name: 'Charged' }))
    // 2% a year for ten years on the $50,000 cheque, drawn from capital.
    expect(runScenario(state.current).feesLow.managementFeeCents).toBe(1_000_000)
  })
})
