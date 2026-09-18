// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import type { Scenario } from '../engine/types'
import { CONVERTIBLE_LOAN, WORKED_EXAMPLE } from '../state/presets'
import { decodeShared, encodeScenario } from '../state/url'

/**
 * Regression guard. Scenarios carry a currency, but every figure used to be
 * formatted as dollars, so the euro example showed dollar signs throughout.
 * Later, each round got its own currency switch with no exchange rate behind
 * it, so euros and dollars were silently added one for one.
 */

/**
 * The calculator's own text. The landing sections around it quote the euro
 * example on purpose, whatever the user's currency, so they are not in scope.
 */
const calculatorText = () => document.getElementById('calculator')?.textContent ?? ''

function open(scenario: Scenario) {
  window.history.replaceState(null, '', `/#s=${encodeScenario(scenario)}`)
  render(<App />)
  return calculatorText()
}

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

/** The one currency switch on the page. */
function currencySwitch(): HTMLElement {
  return screen.getByRole('radiogroup', { name: 'Currency' })
}

describe('every figure on the page is in the scenario’s currency', () => {
  it('shows euros for a euro deal, and no dollar sign anywhere', () => {
    const text = open(CONVERTIBLE_LOAN)
    expect(text).toContain('€')
    expect(text).not.toContain('$')
  })

  it('shows dollars for a dollar deal, and no euro sign anywhere', () => {
    const text = open(WORKED_EXAMPLE)
    expect(text).toContain('$')
    expect(text).not.toContain('€')
  })

  it('has exactly one currency switch, because a scenario has exactly one currency', () => {
    open(WORKED_EXAMPLE)
    expect(screen.getAllByRole('radiogroup', { name: 'Currency' })).toHaveLength(1)
  })

  it('switches everything, charts and explanations included, when the currency changes', () => {
    open(WORKED_EXAMPLE)
    fireEvent.click(within(currencySwitch()).getByRole('radio', { name: 'Euro' }))
    const text = calculatorText()
    expect(text).toContain('€')
    expect(text).not.toContain('$')
  })

  it('carries the change into the shared link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    open(WORKED_EXAMPLE)
    fireEvent.click(within(currencySwitch()).getByRole('radio', { name: 'Euro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this calculation' }))
    const expected: Scenario = { ...WORKED_EXAMPLE, currency: 'EUR' }
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    const link = writeText.mock.calls[0]?.[0] as string
    expect(await decodeShared(link.split('/shared#')[1] ?? '')).toEqual(expected)
  })
})
