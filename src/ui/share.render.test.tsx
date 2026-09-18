// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import { setAnalyticsSink } from '../analytics/track'
import type { AnalyticsEvent } from '../analytics/track'
import { STARTING_POINT, WORKED_EXAMPLE } from '../state/presets'
import { decodeScenario, encodeScenario } from '../state/url'

/**
 * Sharing lives in a button, not the address bar: the page's address stays
 * plain, and the copied link reopens the calculation someone was looking at.
 */

const button = () => screen.getByRole('button', { name: 'Copy link to this calculation' })

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

/** The scenario inside a copied link. */
const scenarioIn = (link: string) => decodeScenario(link.split('#s=')[1] ?? '')

afterEach(() => {
  cleanup()
  setAnalyticsSink(undefined)
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('the address bar', () => {
  it('stays plain on a first visit and while the calculator is edited', () => {
    window.history.replaceState(null, '', '/')
    render(<App />)
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Currency' })).getByRole('radio', { name: 'US dollar' }))
    expect(window.location.href).toBe('http://localhost:3000/')
  })

  it('opens a shared link on its calculation, then drops the scenario from the address', () => {
    window.history.replaceState(null, '', `/#s=${encodeScenario(WORKED_EXAMPLE)}`)
    render(<App />)
    expect(window.location.href).toBe('http://localhost:3000/')
    // The worked example has later rounds; the starting point has none.
    expect(screen.getByRole('region', { name: 'Follow on or sit out?' })).toBeTruthy()
  })
})

describe('copy link', () => {
  it('copies a link to the calculation on screen and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    const events: AnalyticsEvent[] = []
    setAnalyticsSink((e) => events.push(e))
    render(<App />)
    fireEvent.click(button())
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Link copied'))
    const link = writeText.mock.calls[0]?.[0] as string
    expect(link.startsWith('http://localhost:3000/#s=')).toBe(true)
    expect(scenarioIn(link)).toEqual(STARTING_POINT)
    expect(window.location.hash).toBe('')
    expect(events.map((e) => e.name)).toEqual(expect.arrayContaining(['share_clicked', 'calculation_link_copied']))
  })

  it('shows the link to copy by hand when the clipboard is blocked', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')))
    render(<App />)
    fireEvent.click(button())
    const field = (await screen.findByLabelText('Copy this link:')) as HTMLInputElement
    expect(scenarioIn(field.value)).toEqual(STARTING_POINT)
  })
})
