// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../App'
import type { Scenario } from '../engine/types'
import { CONVERTIBLE_LOAN, WORKED_EXAMPLE } from '../state/presets'
import { encodeScenario } from '../state/url'

/**
 * Regression guard. Scenarios carry a currency, but every figure used to be
 * formatted as dollars, so the euro example showed dollar signs throughout.
 */

function open(scenario: Scenario) {
  window.history.replaceState(null, '', `/#s=${encodeScenario(scenario)}`)
  render(<App />)
  return document.body.textContent ?? ''
}

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

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

  it('switches everything, charts and explanations included, when the currency changes', () => {
    open(WORKED_EXAMPLE)
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'GBP' } })
    const text = document.body.textContent ?? ''
    expect(text).toContain('£')
    expect(text).not.toContain('$')
  })

  it('carries the change into the shared link', () => {
    open(WORKED_EXAMPLE)
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'EUR' } })
    expect(window.location.hash).toBe(`#s=${encodeScenario({ ...WORKED_EXAMPLE, currency: 'EUR' })}`)
  })
})
