// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import { toCents } from '../engine/money'
import type { Scenario } from '../engine/types'
import { EXAMPLE, SAFE_AT_A_CAP, blankScenario } from '../state/presets'
import { encodeScenario } from '../state/url'

/**
 * "How it could end": the deal at four outcomes, from a total loss to a company
 * that grows 100×, with the power law worked out from the user's own numbers.
 */

function open(scenario: Scenario) {
  window.history.replaceState(null, '', `/#s=${encodeScenario(scenario)}`)
  render(<App />)
}

const section = () => screen.queryByRole('region', { name: 'How it could end' })
const table = () => within(section() as HTMLElement).getByRole('table')

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('the four endings', () => {
  it('shows the example at four outcomes, from nothing to €256,000', () => {
    open(EXAMPLE)
    const rows = within(table()).getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      'The company failsSold for nothing, or wound down',
      'It returns its capitalSold for the €32M it raised',
      'It grows 10×Sold for 10× the €5M you invested at',
      'It grows 100×Sold for 100× the €5M you invested at',
    ])
    const text = rows.map((r) => r.textContent).join(' | ')
    expect(text).toContain('€0')
    expect(text).toContain('€5,000 – €25,600')
    expect(text).toContain('€256,000')
    expect(text).toContain('51.2×')
  })

  it('works the power law out from the deal', () => {
    open(EXAMPLE)
    const text = section()?.textContent ?? ''
    expect(text).toContain('One company that grows 100× returns 51.2× what you put in: enough to cover 50 other cheques like this one that fail.')
    expect(text).toContain('A company that grows 10× only gets this cheque back, and covers no other.')
  })

  it('says when a 10× company does not even return the cheque', () => {
    // A 10x company that raised far more than it sold for: the preference stack takes it.
    open({ ...EXAMPLE, exit: { ...EXAMPLE.exit, totalRaisedCents: toCents(200_000_000) } })
    expect(section()?.textContent).toContain('A company that grows 10× does not even return this cheque')
  })

  it('moves the exit slider when an outcome is chosen, and marks it', () => {
    open(EXAMPLE)
    fireEvent.click(within(table()).getByRole('button', { name: 'Use a €500,000,000 exit' }))
    expect(screen.getByLabelText('Exit valuation').getAttribute('aria-valuetext')).toBe('€500,000,000')
    expect(within(table()).queryByRole('button', { name: 'Use a €500,000,000 exit' })).toBeNull()
    expect(table().textContent).toContain('Selected')
  })

  it('offers no exit for a company that fails, which the slider cannot reach', () => {
    open(EXAMPLE)
    const fails = within(table()).getAllByRole('row')[1] as HTMLElement
    expect(within(fails).queryByRole('button')).toBeNull()
  })

  it('measures a SAFE’s growth from its cap', () => {
    open(SAFE_AT_A_CAP)
    expect(table().textContent).toContain('Sold for 10× your $5M cap')
    expect(table().textContent).toContain('$50,000,000')
  })

  it('shows nothing until there is a cheque to end', () => {
    open(blankScenario('EUR', new Date('2026-09-19T12:00:00Z')))
    expect(section()).toBeNull()
  })
})
