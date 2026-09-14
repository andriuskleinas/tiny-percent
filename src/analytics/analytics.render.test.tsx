// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import { resetAnalytics, setAnalyticsSink } from './track'
import type { AnalyticsEvent } from './track'

/** The PRD §40 journey on the real page, and the funnel it reports. */

let events: AnalyticsEvent[] = []
const names = () => events.map((e) => e.name)

beforeEach(() => {
  events = []
  setAnalyticsSink((event) => events.push(event))
  Element.prototype.scrollIntoView = vi.fn()
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  cleanup()
  resetAnalytics()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

const region = (name: string) => screen.getByRole('region', { name })

describe('the funnel, reported from the page', () => {
  it('follows a visitor from the hero to a strongly activated calculation', async () => {
    render(<App />)
    expect(names()).toEqual(['page_viewed'])

    fireEvent.click(screen.getByRole('button', { name: 'Calculate my investment' }))
    expect(events.at(-1)).toEqual({ name: 'hero_cta_clicked', placement: 'hero' })

    const investment = within(region('Your initial investment'))
    fireEvent.change(investment.getByLabelText('Investment amount'), { target: { value: '10k' } })
    expect(names()).toEqual(expect.arrayContaining(['calculator_started', 'initial_investment_entered', 'ownership_calculated', 'activated']))

    const rounds = () => within(region('Future funding rounds'))
    fireEvent.click(rounds().getAllByRole('button', { name: '+ Add funding round' })[0] as HTMLElement)
    expect(names()).toContain('pro_rata_scenario_viewed')
    fireEvent.click(rounds().getByRole('button', { name: '+ Add funding round' }))
    expect(names().filter((n) => n === 'funding_round_added')).toHaveLength(2)
    expect(names()).toContain('second_funding_round_added')

    const seriesA = within(rounds().getByRole('article', { name: 'Series A' }))
    fireEvent.click(seriesA.getByRole('button', { name: 'Invest pro-rata' }))
    expect(events).toContainEqual({ name: 'follow_on_amount_entered', pro_rata: true })

    fireEvent.click(within(region('What could your investment be worth?')).getByRole('radio', { name: '€250M' }))
    expect(events).toContainEqual({ name: 'exit_valuation_changed', preset: true })
    expect(names()).toContain('exit_scenario_completed')
    expect(names()).toContain('strongly_activated')

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    fireEvent.click(screen.getByRole('button', { name: 'Share calculation' }))
    await waitFor(() => expect(events).toContainEqual({ name: 'calculation_link_copied', method: 'clipboard' }))
    expect(names()).toContain('share_clicked')

    const updates = within(region('Want more tools for angel investing?'))
    fireEvent.change(updates.getByLabelText('Email address'), { target: { value: 'angel@example.com' } })
    fireEvent.click(updates.getByRole('button', { name: 'Notify me' }))
    expect(names()).toContain('email_submitted')

    for (const event of events) {
      const json = JSON.stringify(event)
      expect(json).not.toContain('@')
      expect(json).not.toMatch(/\d{3,}/)
    }
  })

  it('reports each example button by where it sits, and the load it causes', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'See an example' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open this example in calculator →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Load example' }))
    expect(events.filter((e) => e.name === 'example_cta_clicked')).toEqual([
      { name: 'example_cta_clicked', placement: 'hero' },
      { name: 'example_cta_clicked', placement: 'worked_example' },
    ])
    expect(events.filter((e) => e.name === 'example_loaded').map((e) => 'placement' in e && e.placement)).toEqual([
      'hero',
      'worked_example',
      'toolbar',
    ])
    expect(names()).not.toContain('calculator_started')
  })

  it('reports the other calculator buttons by placement', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Use calculator' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try the calculator' }))
    expect(events.filter((e) => e.name === 'hero_cta_clicked')).toEqual([
      { name: 'hero_cta_clicked', placement: 'nav' },
      { name: 'hero_cta_clicked', placement: 'features' },
    ])
  })

  it('does not report an invalid email as submitted', () => {
    render(<App />)
    const updates = within(region('Want more tools for angel investing?'))
    fireEvent.change(updates.getByLabelText('Email address'), { target: { value: 'nope' } })
    fireEvent.click(updates.getByRole('button', { name: 'Notify me' }))
    expect(names()).not.toContain('email_submitted')
  })
})
