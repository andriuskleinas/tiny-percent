// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import { STARTING_POINT } from '../state/presets'
import { encodeScenario } from '../state/url'

/**
 * The landing page around the calculator (PRD §7–§38). Every figure these
 * sections quote about the €5,000 example is computed by the engine, so the
 * expected values here are golden case L in `tools/oracle.py`.
 */

const scrolled: Element[] = []

beforeEach(() => {
  scrolled.length = 0
  Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
    scrolled.push(this)
  })
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

const region = (name: string | RegExp) => screen.getByRole('region', { name })
const calculator = () => region('Calculate your investment')

describe('the page structure', () => {
  it('has one h1, the PRD headline', () => {
    render(<App />)
    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0]?.textContent).toBe('See what your angel investment could become.')
  })

  it('puts the calculator straight after the hero', () => {
    render(<App />)
    const sections = [...document.querySelectorAll('main > section')].map((s) => s.id)
    expect(sections.slice(0, 2)).toEqual(['hero', 'calculator'])
    expect(sections).toEqual(expect.arrayContaining(['features', 'how-it-works', 'example', 'learn', 'faq', 'updates']))
  })

  it('has landmarks for navigation, the main content and the footer', () => {
    render(<App />)
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })
})

describe('navigation', () => {
  it('scrolls to a section without touching the scenario in the address', () => {
    render(<App />)
    const hash = window.location.hash
    expect(hash).toMatch(/^#s=/)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'FAQ' }))
    expect(window.location.hash).toBe(hash)
    expect(scrolled.map((el) => el.id)).toContain('faq')
  })

  it('arriving at /#calculator from another page scrolls there and opens the default calculation', () => {
    window.history.replaceState(null, '', '/#calculator')
    render(<App />)
    expect(scrolled.map((el) => el.id)).toContain('calculator')
    expect(window.location.hash).toBe(`#s=${encodeScenario(STARTING_POINT)}`)
  })

  it('offers only calculator, how it works and FAQ, plus the calculator button', () => {
    render(<App />)
    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(nav.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Angel Investment Calculator',
      'Calculator',
      'How it works',
      'FAQ',
    ])
    expect(nav.getByRole('button', { name: 'Use calculator' })).toBeTruthy()
  })
})

describe('the hero', () => {
  it('says it is free with no account, and previews real numbers from the example', () => {
    render(<App />)
    const hero = within(region('See what your angel investment could become.'))
    expect(hero.getByText('Free. No account required.')).toBeTruthy()
    const preview = within(hero.getByRole('figure'))
    expect(preview.getByText('€5,000 invested')).toBeTruthy()
    expect(preview.getByText('Initial ownership').nextSibling?.textContent).toBe('0.10%')
    expect(preview.getByText('Ownership after future rounds').nextSibling?.textContent).toBe('0.051%')
    expect(preview.getByText('Potential value at a €100M exit').nextSibling?.textContent).toBe('€51,200')
  })

  it('"Calculate my investment" goes to the calculator and puts the cursor in the amount', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Calculate my investment' }))
    expect(scrolled.map((el) => el.id)).toContain('calculator')
    expect(document.activeElement).toBe(within(calculator()).getByLabelText('Investment amount'))
  })

  it('"See an example" loads the example into the calculator', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'See an example' }))
    expect(within(calculator()).getByRole('rowheader', { name: /Series C/ })).toBeTruthy()
    expect(scrolled.map((el) => el.id)).toContain('calculator')
  })
})

describe('the worked example', () => {
  it('quotes the example from the engine, not from copy', () => {
    render(<App />)
    const example = within(region('What happens to a €5,000 angel investment?'))
    expect(example.getByText('Initial ownership').nextSibling?.textContent).toBe('0.10%')
    expect(example.getByText('Ownership after dilution').nextSibling?.textContent).toBe('0.051%')
    expect(example.getByText('Potential value at a €250M exit').nextSibling?.textContent).toBe('€128,000')
  })

  it('opens itself in the calculator', () => {
    window.history.replaceState(null, '', `/#s=${encodeScenario(STARTING_POINT)}`)
    render(<App />)
    const example = within(region('What happens to a €5,000 angel investment?'))
    fireEvent.click(example.getByRole('button', { name: 'Open this example in calculator →' }))
    expect(within(calculator()).getByRole('rowheader', { name: /Series C/ })).toBeTruthy()
    expect(within(calculator()).getByRole('radio', { name: '€250M' }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('the explanations and FAQ', () => {
  it('explains equity, dilution, pro-rata and exits with the example’s own numbers', () => {
    render(<App />)
    const learn = region('From cheque to exit.')
    expect(learn.textContent).toContain('€5,000 ÷ €5,000,000 = 0.10%')
    expect(learn.textContent).toContain('€3,000')
  })

  it('answers the eight PRD questions, each one expandable', () => {
    render(<App />)
    const faq = region('Frequently asked questions')
    const questions = [...faq.querySelectorAll('details > summary')].map((s) => s.firstChild?.textContent)
    expect(questions).toEqual([
      'How is startup ownership calculated?',
      'What is dilution?',
      'What does pro-rata mean?',
      'What is the difference between pre-money and post-money valuation?',
      'Is the calculated stake value real money?',
      'Does the calculator predict startup returns?',
      'Is the calculator free?',
      'Do I need an account?',
    ])
  })
})

describe('the updates signup', () => {
  it('is optional and asks for a valid address', () => {
    render(<App />)
    const updates = within(region('Want more tools for angel investing?'))
    fireEvent.change(updates.getByLabelText('Email address'), { target: { value: 'not-an-email' } })
    fireEvent.click(updates.getByRole('button', { name: 'Notify me' }))
    expect(updates.getByText('Enter a valid email address.')).toBeTruthy()
  })

  it('sends nothing anywhere while signups are not switched on, and says so', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<App />)
    const updates = within(region('Want more tools for angel investing?'))
    fireEvent.change(updates.getByLabelText('Email address'), { target: { value: 'angel@example.com' } })
    fireEvent.click(updates.getByRole('button', { name: 'Notify me' }))
    expect(updates.getByRole('status').textContent).toMatch(/nothing was sent or stored/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('the footer', () => {
  it('carries the full disclaimer and links to privacy and terms', () => {
    render(<App />)
    const footer = within(screen.getByRole('contentinfo'))
    expect(footer.getByText(/does not constitute investment, legal, tax or financial advice/)).toBeTruthy()
    expect(footer.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
    expect(footer.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    expect(footer.getByText('Free tools for understanding startup investments.')).toBeTruthy()
  })
})
