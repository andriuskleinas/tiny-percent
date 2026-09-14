// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import App from '../App'
import { SAFE_AT_A_CAP } from '../state/presets'
import { encodeScenario } from '../state/url'

/**
 * The instrument is a label only: SAFEs and convertible loans are priced at the
 * round's valuation, and caps, discounts and interest are not modelled. Every
 * instrument selector must say so, or picking one implies a difference in the
 * maths that is not there.
 */

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('the instrument selector says it does not change the maths', () => {
  it('puts the note under every instrument selector, entry and follow-on alike', () => {
    window.history.replaceState(null, '', `/#s=${encodeScenario(SAFE_AT_A_CAP)}`)
    render(<App />)
    const selectors = screen.getAllByLabelText('Instrument')
    expect(selectors).toHaveLength(2)
    for (const select of selectors) {
      const field = select.parentElement as HTMLElement
      expect(field.textContent).toContain('priced at this round’s valuation')
      expect(field.textContent).toContain('caps, discounts and interest are not modelled')
    }
  })
})
