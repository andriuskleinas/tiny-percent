// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import { SITE } from '../site'
import { UpdatesSignup } from './Sections'
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
const calculator = () => region('Run your own numbers')

describe('the page structure', () => {
  it('has one h1, the headline', () => {
    render(<App />)
    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0]?.textContent).toBe('See what your startup investment could become')
  })

  it('puts the calculator straight after the hero', () => {
    render(<App />)
    const sections = [...document.querySelectorAll('main > section')].map((s) => s.id)
    expect(sections.slice(0, 2)).toEqual(['hero', 'calculator'])
    expect(sections).toEqual(['hero', 'calculator', 'learn'])
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
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Use calculator' }))
    expect(window.location.hash).toBe(hash)
    expect(scrolled.map((el) => el.id)).toContain('calculator')
  })

  it('arriving at /#calculator from another page scrolls there and opens the default calculation', () => {
    window.history.replaceState(null, '', '/#calculator')
    render(<App />)
    expect(scrolled.map((el) => el.id)).toContain('calculator')
    expect(window.location.hash).toBe(`#s=${encodeScenario(STARTING_POINT)}`)
  })

  it('has only the logo and the calculator button, no menu links', () => {
    render(<App />)
    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(nav.getAllByRole('link').map((a) => a.textContent)).toEqual(['tinypercent'])
    expect(nav.getByRole('button', { name: 'Use calculator' })).toBeTruthy()
  })
})

describe('the hero', () => {
  it('previews real numbers from a €5,000 Pre-seed example, and has one call to action', () => {
    render(<App />)
    const hero = within(region('See what your startup investment could become'))
    expect(hero.getByText(/Every time a startup raises money, your share of it shrinks/)).toBeTruthy()
    expect(hero.queryByRole('button', { name: 'See an example' })).toBeNull()
    expect(hero.queryByText('Free. No account required.')).toBeNull()
    const preview = within(hero.getByRole('figure'))
    expect(preview.getByText('€5,000 invested at Pre-seed')).toBeTruthy()
    expect(preview.getByText('Initial ownership').nextSibling?.textContent).toBe('0.10%')
    expect(preview.getByText('Ownership after future rounds').nextSibling?.textContent).toBe('0.051%')
    expect(preview.getByText('Potential value at a €100M exit').nextSibling?.textContent).toBe('€51,200')
  })

  it('plays the example round by round while it is on screen, and can be paused', () => {
    vi.useFakeTimers()
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          observers.push(callback)
        }
        observe() {}
        disconnect() {}
      },
    )
    try {
      render(<App />)
      const figure = screen.getByRole('figure')
      const current = () => figure.querySelector('[data-current]')?.textContent
      expect(current()).toBe('Exit')
      act(() => observers.forEach((notify) => notify([{ isIntersecting: true }])))
      act(() => void vi.advanceTimersByTime(400))
      expect(current()).toBe('Pre-seed')
      act(() => void vi.advanceTimersByTime(1700))
      expect(current()).toBe('Seed')
      fireEvent.click(within(figure).getByRole('button', { name: 'Pause the example' }))
      act(() => void vi.advanceTimersByTime(10_000))
      expect(current()).toBe('Seed')
      fireEvent.click(within(figure).getByRole('button', { name: 'Play the example' }))
      act(() => void vi.advanceTimersByTime(1700))
      expect(current()).toBe('Series A')
    } finally {
      vi.unstubAllGlobals()
      vi.useRealTimers()
    }
  })

  it('the hero’s "Use calculator" goes to the calculator and puts the cursor in the amount', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('region', { name: 'See what your startup investment could become' })).getByRole('button', { name: 'Use calculator' }))
    expect(scrolled.map((el) => el.id)).toContain('calculator')
    expect(document.activeElement).toBe(within(calculator()).getByLabelText('Investment amount'))
  })
})

describe('the explanations', () => {
  it('has no FAQ, features, how-it-works or worked-example sections', () => {
    render(<App />)
    for (const id of ['faq', 'features', 'how-it-works', 'example']) expect(document.getElementById(id)).toBeNull()
  })

  it('explains equity, dilution, pro-rata and exits with the example’s own numbers', () => {
    render(<App />)
    const learn = region('How a small stake grows, shrinks and pays out')
    const text = learn.textContent ?? ''
    expect(text).toContain('€4,000,000 + €1,000,000 =€5,000,000')
    expect(text).toContain('€5,000 ÷ €5,000,000 =0.10%')
    expect(text).toContain('0.10% × 80% =0.080%')
    expect(text).toContain('0.080% × €15,000,000 =€12,000')
    expect(text).toContain('0.10% × €3,000,000 =€3,000')
    expect(text).toContain('0.080% + (€3,000 ÷ €15,000,000) =0.10%')
    expect(text).toContain('0.10% × 80% × 80% × 80% =0.0512%')
    expect(text).toContain('0.0512% × €250,000,000 =€128,000')
    expect(text).toContain('€128,000 ÷ €5,000 =25.6×')
    expect(text).toContain('€128,000 − 20% × (€128,000 − €5,000) =€103,400 · 20.7×')
  })
})

describe('the waiting list', () => {
  const updates = () => within(region('More tools are on the way'))
  const fill = (first: string, last: string, email: string) => {
    fireEvent.change(updates().getByLabelText('First name'), { target: { value: first } })
    fireEvent.change(updates().getByLabelText('Surname'), { target: { value: last } })
    fireEvent.change(updates().getByLabelText('Email address'), { target: { value: email } })
    fireEvent.click(updates().getByRole('button', { name: 'Join the waiting list' }))
  }
  const respond = (status: number, body: unknown) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

  it('is hidden from the page while the site is educational only', () => {
    expect(SITE.waitlist).toBe(false)
    render(<App />)
    expect(screen.queryByRole('region', { name: 'More tools are on the way' })).toBeNull()
  })

  it('has no list of upcoming tools', () => {
    render(<UpdatesSignup />)
    expect(region('More tools are on the way').querySelectorAll('li')).toHaveLength(0)
  })

  it('asks for a first name, a surname and a valid email before sending anything', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<UpdatesSignup />)
    fill('', ' ', 'not-an-email')
    expect(updates().getByText('Enter your first name.')).toBeTruthy()
    expect(updates().getByText('Enter your surname.')).toBeTruthy()
    expect(updates().getByText('Enter a valid email address.')).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends the details to the site’s own endpoint and confirms once they are saved', async () => {
    const fetchSpy = respond(200, { ok: true })
    render(<UpdatesSignup />)
    fill(' Ada ', 'Lovelace', 'Ada@Example.com')
    expect(await updates().findByText('You’re on the waiting list, Ada.')).toBeTruthy()
    expect(updates().getByText('ada@example.com')).toBeTruthy()
    const [url, init] = fetchSpy.mock.calls[0] ?? []
    expect(url).toBe('/api/waitlist')
    expect(JSON.parse(String(init?.body))).toEqual({ firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', website: '' })
  })

  it('says plainly when the details were not saved', async () => {
    respond(502, { ok: false })
    render(<UpdatesSignup />)
    fill('Ada', 'Lovelace', 'ada@example.com')
    expect(await updates().findByText(/Something went wrong and your details weren’t saved/)).toBeTruthy()
    expect(updates().getByLabelText('First name')).toBeTruthy()
  })

  it('says the list is not open yet when the sheet is not connected', async () => {
    respond(503, { ok: false, error: 'unavailable' })
    render(<UpdatesSignup />)
    fill('Ada', 'Lovelace', 'ada@example.com')
    expect(await updates().findByText(/The waiting list isn’t open yet/)).toBeTruthy()
  })
})

describe('the footer', () => {
  it('carries the full disclaimer and links to privacy and terms', () => {
    render(<App />)
    const footer = within(screen.getByRole('contentinfo'))
    expect(footer.getByText(/does not constitute investment, legal, tax or financial advice/)).toBeTruthy()
    expect(footer.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
    expect(footer.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    expect(footer.getByText(/Your tiny percent, from first cheque to exit/)).toBeTruthy()
  })
})
