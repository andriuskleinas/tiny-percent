// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import type { Scenario } from '../engine/types'
import { CONVERTIBLE_LOAN, SAFE_AT_A_CAP, WORKED_EXAMPLE } from '../state/presets'
import { encodeScenario } from '../state/url'

/**
 * The entry panel asks for what the instrument actually has: a valuation for
 * shares, a cap and a discount for a SAFE, and interest as well for a note. It
 * then says where the SAFE or note converts, or that it has not yet.
 */

const panel = () => document.getElementById('your-investment') as HTMLElement
const table = () => screen.getAllByRole('table').find((t) => t.textContent?.includes('Paper value')) as HTMLElement

function open(scenario: Scenario) {
  window.history.replaceState(null, '', `/#s=${encodeScenario(scenario)}`)
  render(<App />)
}

function choose(name: string) {
  fireEvent.click(within(screen.getByRole('radiogroup', { name: 'What you are buying' })).getByRole('radio', { name }))
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('the fields follow the instrument', () => {
  it('asks for a company valuation when you buy shares', () => {
    open(WORKED_EXAMPLE)
    const inside = within(panel())
    expect(inside.getByRole('radio', { name: 'Shares', checked: true })).toBeTruthy()
    expect(inside.getByLabelText('Company valuation')).toBeTruthy()
    expect(inside.queryByLabelText('Discount')).toBeNull()
  })

  it('asks for a cap and a discount for a SAFE, and no interest', () => {
    open(WORKED_EXAMPLE)
    choose('SAFE')
    const inside = within(panel())
    expect(inside.getByLabelText('Valuation cap')).toBeTruthy()
    expect(inside.getByLabelText('Discount')).toBeTruthy()
    expect(inside.getByRole('radiogroup', { name: 'Cap basis' })).toBeTruthy()
    expect(inside.queryByLabelText('Interest rate a year')).toBeNull()
  })

  it('asks for interest as well for a convertible note', () => {
    open(WORKED_EXAMPLE)
    choose('Convertible note')
    const inside = within(panel())
    expect(inside.getByLabelText('Interest rate a year')).toBeTruthy()
    expect(inside.getByRole('radiogroup', { name: 'Interest' })).toBeTruthy()
  })
})

describe('what the panel says about conversion', () => {
  it('says where a SAFE converts, at which price, and what it is worth', () => {
    open(SAFE_AT_A_CAP)
    const text = panel().textContent ?? ''
    expect(text).toContain('Your ownership at the cap')
    expect(text).toContain('2.00%')
    expect(text).toContain('Converts in Seed at the cap:')
    expect(text).toContain('1.40% once that round closes, worth $140,000')
  })

  it('shows the note’s interest converting, and says it is not money you paid', () => {
    open(CONVERTIBLE_LOAN)
    const text = panel().textContent ?? ''
    expect(text).toContain('Converts in Seed at the cap:')
    expect(text).toMatch(/includes €8,0\d\d of interest, which converts but is not money you paid/)
  })

  it('says a SAFE with no round after it has not converted yet', () => {
    open({ ...SAFE_AT_A_CAP, rounds: SAFE_AT_A_CAP.rounds.slice(0, 1) })
    expect(panel().textContent).toContain('Not converted yet.')
  })

  it('marks a pre-money cap as an estimate', () => {
    const [first, ...rest] = SAFE_AT_A_CAP.rounds
    if (!first) throw new Error('preset has no entry')
    open({ ...SAFE_AT_A_CAP, rounds: [{ ...first, valuationBasis: 'pre' }, ...rest] })
    expect(panel().textContent).toContain('Estimate.')
  })

  it('says nothing about conversion for shares', () => {
    open(WORKED_EXAMPLE)
    const text = panel().textContent ?? ''
    expect(text).not.toContain('Converts in')
    expect(text).not.toContain('Not converted yet')
  })

  it('notes the cap and the conversion in the round-by-round table', () => {
    open(SAFE_AT_A_CAP)
    const text = table().textContent ?? ''
    expect(text).toContain('SAFE, at the cap')
    expect(text).toContain('SAFE converts at the cap')
  })
})

describe('a note’s maturity', () => {
  const due = (patch: Record<string, unknown>): Scenario => {
    const [first, ...rest] = CONVERTIBLE_LOAN.rounds
    if (!first?.participation) throw new Error('preset has no note')
    // Due a year in, before the Seed on 2025-01-01.
    return { ...CONVERTIBLE_LOAN, rounds: [{ ...first, participation: { ...first.participation, maturityDate: '2024-01-01', ...patch } }, ...rest] }
  }

  it('asks for a maturity date on a note, and what happens only once there is one', () => {
    open(CONVERTIBLE_LOAN)
    const inside = within(panel())
    expect(inside.getByLabelText('Maturity date')).toBeTruthy()
    expect(inside.queryByRole('radiogroup', { name: 'At maturity' })).toBeNull()
    fireEvent.change(inside.getByLabelText('Maturity date'), { target: { value: '2024-01-01' } })
    expect(inside.getByRole('radio', { name: 'Repaid', checked: true })).toBeTruthy()
    expect(inside.queryByLabelText('Maturity valuation')).toBeNull()
  })

  it('says a repaid note came back with its interest, and holds nothing after', () => {
    open(due({}))
    const text = panel().textContent ?? ''
    expect(text).toContain('Repaid at maturity on Jan 1, 2024:')
    expect(text).toContain('€54,000 back, your €50,000 and €4,000 of interest')
    expect(text).not.toContain('Converts in Seed')
  })

  it('asks for a maturity valuation when the note converts, and says where it converted', () => {
    open(due({ atMaturity: 'convert' }))
    const inside = within(panel())
    expect(inside.getByLabelText('Maturity valuation')).toBeTruthy()
    expect(panel().textContent).toContain('Converts at maturity on Jan 1, 2024 at €5,000,000:')
    expect(panel().textContent).toContain('1.08%, before later rounds dilute it')
    expect(table().textContent).toContain('Note converted at maturity')
  })

  it('waits for the Seed when extended', () => {
    open(due({ atMaturity: 'extend' }))
    expect(panel().textContent).toContain('Converts in Seed at the cap:')
  })

  it('offers no maturity on a SAFE', () => {
    open(SAFE_AT_A_CAP)
    expect(within(panel()).queryByLabelText('Maturity date')).toBeNull()
  })
})
