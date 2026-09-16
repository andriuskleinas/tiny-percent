// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import { UpdatesSignup } from '../landing/Sections'
import { positionOf } from '../ui/exitScale'
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

    fireEvent.click(within(screen.getByRole('region', { name: 'See what your startup investment could become' })).getByRole('button', { name: 'Use calculator' }))
    expect(events.at(-1)).toEqual({ name: 'hero_cta_clicked', placement: 'hero' })

    const investment = within(region('Your initial investment'))
    fireEvent.change(investment.getByLabelText('Investment amount'), { target: { value: '10k' } })
    expect(names()).toEqual(expect.arrayContaining(['calculator_started', 'initial_investment_entered', 'ownership_calculated', 'activated']))

    const rounds = () => within(region('Future funding rounds'))
    fireEvent.click(rounds().getByRole('button', { name: '+ Add funding round' }))
    expect(names()).toContain('pro_rata_scenario_viewed')
    fireEvent.click(rounds().getByRole('button', { name: '+ Add funding round' }))
    expect(names().filter((n) => n === 'funding_round_added')).toHaveLength(2)
    expect(names()).toContain('second_funding_round_added')

    const seriesA = within(rounds().getByRole('article', { name: 'Series A' }))
    fireEvent.click(seriesA.getByRole('radio', { name: /Invest pro-rata/ }))
    expect(events).toContainEqual({ name: 'follow_on_amount_entered', pro_rata: true })

    const slider = within(region('What could it be worth?')).getByRole('slider', { name: 'Exit valuation' })
    fireEvent.change(slider, { target: { value: String(positionOf(25_000_000_000)) } })
    expect(events).toContainEqual({ name: 'exit_valuation_changed', preset: true })
    expect(names()).toContain('exit_scenario_completed')
    expect(names()).toContain('strongly_activated')


    for (const event of events) {
      const json = JSON.stringify(event)
      expect(json).not.toContain('@')
      expect(json).not.toMatch(/\d{3,}/)
    }
  })

  it('reports the other calculator buttons by placement', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Use calculator' }))
    expect(events.filter((e) => e.name === 'hero_cta_clicked')).toEqual([
      { name: 'hero_cta_clicked', placement: 'nav' },
    ])
  })

  it('reports a waiting-list signup only once it is saved, and never an invalid one', async () => {
    render(<UpdatesSignup />)
    const form = within(region('More tools are on the way'))
    fireEvent.change(form.getByLabelText('Email address'), { target: { value: 'nope' } })
    fireEvent.click(form.getByRole('button', { name: 'Join the waiting list' }))
    expect(names()).not.toContain('email_submitted')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    fireEvent.change(form.getByLabelText('First name'), { target: { value: 'Ada' } })
    fireEvent.change(form.getByLabelText('Surname'), { target: { value: 'Lovelace' } })
    fireEvent.change(form.getByLabelText('Email address'), { target: { value: 'angel@example.com' } })
    fireEvent.click(form.getByRole('button', { name: 'Join the waiting list' }))
    await waitFor(() => expect(names()).toContain('email_submitted'))
    expect(JSON.stringify(events)).not.toContain('@')
  })

  it('does not report an invalid signup as submitted', () => {
    render(<UpdatesSignup />)
    const updates = within(region('More tools are on the way'))
    fireEvent.change(updates.getByLabelText('Email address'), { target: { value: 'nope' } })
    fireEvent.click(updates.getByRole('button', { name: 'Join the waiting list' }))
    expect(names()).not.toContain('email_submitted')
  })
})
