// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import { setAnalyticsSink } from '../analytics/track'
import type { AnalyticsEvent } from '../analytics/track'
import { SITE } from '../site'
import { LegalPage } from './LegalPage'

/**
 * "Buy me a coffee" appears three times: under the hero example, under the
 * results and in the footer. Every link goes to the one configured page, in a new tab.
 */

afterEach(() => {
  cleanup()
  setAnalyticsSink(undefined)
})

const coffee = () => screen.getAllByRole('link', { name: /Buy me a coffee/ })

describe('support links', () => {
  it('appear under the hero example, under the results and in the footer', () => {
    render(<App />)
    expect(coffee()).toHaveLength(3)
    expect(within(document.getElementById('hero') as HTMLElement).getByRole('link', { name: /Buy me a coffee/ })).toBeTruthy()
    expect(within(document.getElementById('calculator') as HTMLElement).getByRole('link', { name: /Buy me a coffee/ })).toBeTruthy()
    expect(within(screen.getByRole('contentinfo')).getByRole('link', { name: /Buy me a coffee/ })).toBeTruthy()
  })

  it('all go to the configured page, in a new tab, and say so', () => {
    render(<App />)
    for (const link of coffee()) {
      expect(link.getAttribute('href')).toBe('https://buymeacoffee.com/tinypercent')
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      expect(link.textContent).toContain('opens Buy Me a Coffee in a new tab')
    }
  })

  it('records where it was clicked, and nothing else', () => {
    const events: AnalyticsEvent[] = []
    setAnalyticsSink((e) => events.push(e))
    render(<App />)
    for (const link of coffee()) fireEvent.click(link)
    expect(events.filter((e) => e.name === 'support_clicked')).toEqual([
      { name: 'support_clicked', placement: 'hero' },
      { name: 'support_clicked', placement: 'calculator' },
      { name: 'support_clicked', placement: 'footer' },
    ])
  })

  it('is explained on the privacy page', () => {
    render(<LegalPage page="privacy" />)
    expect(screen.getByRole('heading', { name: 'Supporting the project' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Buy Me a Coffee’s privacy policy' }).getAttribute('href')).toBe('https://buymeacoffee.com/privacy-policy')
  })

  it('is configured, so the links are not silently missing', () => {
    expect(SITE.supportUrl).toBe('https://buymeacoffee.com/tinypercent')
  })

  it('promises in the hero only what the privacy page says', () => {
    render(<App />)
    const promise = within(screen.getByRole('list', { name: 'What tinypercent does with your data' }))
    expect(promise.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Collects no data', 'No tracking', 'Educational, always free'])
    cleanup()
    render(<LegalPage page="privacy" />)
    expect(document.body.textContent).toMatch(/no accounts, no cookies, no analytics/)
  })
})
