// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import type { Scenario } from '../engine/types'
import { EXAMPLE } from '../state/presets'
import { encodeScenario } from '../state/url'

/**
 * The journey the PRD asks for, on the real page: cheque, ownership, a later
 * round, the follow-on choice, an exit. Every expected figure is from golden
 * case L in `tools/oracle.py` or plain arithmetic on it.
 */

function open(scenario?: Scenario) {
  window.history.replaceState(null, '', scenario ? `/#s=${encodeScenario(scenario)}` : '/')
  render(<App />)
}

const investment = () => screen.getByRole('region', { name: 'Your initial investment' })
const rounds = () => screen.getByRole('region', { name: 'Future funding rounds' })
const exit = () => screen.getByRole('region', { name: 'What could your investment be worth?' })
const summary = () => screen.getByRole('region', { name: 'Your investment' })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('a first visit', () => {
  it('shows what €5,000 buys before anything is typed', () => {
    open()
    expect(within(investment()).getByText('0.10%')).toBeTruthy()
    expect(within(investment()).getByText('of the company, after this round')).toBeTruthy()
  })

  it('recalculates ownership from typed shorthand', () => {
    open()
    fireEvent.change(within(investment()).getByLabelText('Investment amount'), { target: { value: '10k' } })
    expect(within(investment()).getByText('0.20%')).toBeTruthy()
  })

  it('rewrites a typed amount with thousands separators once you leave the field', () => {
    open()
    const field = within(investment()).getByLabelText('Company valuation') as HTMLInputElement
    fireEvent.change(field, { target: { value: '24000000' } })
    fireEvent.blur(field)
    expect(field.value).toBe('24,000,000')
  })
})

describe('start from scratch and load example', () => {
  it('clears every amount and asks for an investment and a valuation', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Start from scratch' }))
    expect((within(investment()).getByLabelText('Investment amount') as HTMLInputElement).value).toBe('')
    expect(within(investment()).getByText(/Enter your investment amount and the company’s valuation/)).toBeTruthy()

    // Regression guard: an amount typed before any valuation has no answer. The
    // exit table once ran the engine on it directly and blanked the whole page.
    fireEvent.change(within(investment()).getByLabelText('Investment amount'), { target: { value: '5000' } })
    expect(screen.getByText(/Enter the company’s valuation to price this round/)).toBeTruthy()
    expect(within(exit()).getByRole('radiogroup', { name: 'Exit valuation' })).toBeTruthy()
    fireEvent.change(within(investment()).getByLabelText('Company valuation'), { target: { value: '4m' } })
    fireEvent.change(within(investment()).getByLabelText('Amount the company is raising'), { target: { value: '1m' } })
    expect(within(investment()).getByText('0.10%')).toBeTruthy()
  })

  it('loads the €5,000 example: diluted to 0.051%, €128,000 and 25.6× at a €250M exit', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Load example' }))
    const table = within(rounds()).getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(5)
    expect(within(table).getByRole('rowheader', { name: /Series C/ })).toBeTruthy()
    expect(within(exit()).getByRole('radio', { name: '€250M' }).getAttribute('aria-checked')).toBe('true')
    expect(within(exit()).getAllByText('€128,000').length).toBeGreaterThan(0)
    expect(within(exit()).getAllByText('25.6×').length).toBeGreaterThan(0)
    expect(within(exit()).getAllByText('0.051%').length).toBeGreaterThan(0)
  })
})

describe('future rounds and the follow-on choice', () => {
  it('keeps loaded rounds collapsed to a summary until you edit one', () => {
    open(EXAMPLE)
    const seriesB = within(rounds()).getByRole('article', { name: 'Series B' })
    const edit = within(seriesB).getByRole('button', { name: 'Edit Series B' })
    expect(edit.getAttribute('aria-expanded')).toBe('false')
    expect(within(seriesB).queryByLabelText('New capital raised')).toBeNull()
    expect(seriesB.textContent).toContain('€8,000,000 at €40,000,000 post-money')
    fireEvent.click(edit)
    expect(edit.getAttribute('aria-expanded')).toBe('true')
    expect(within(seriesB).getByLabelText('New capital raised')).toBeTruthy()
    fireEvent.click(edit)
    expect(within(seriesB).queryByLabelText('New capital raised')).toBeNull()
  })

  it('opens a round you have just added', () => {
    open(EXAMPLE)
    fireEvent.click(within(rounds()).getByRole('button', { name: '+ Add funding round' }))
    const added = within(rounds()).getByRole('article', { name: 'Series D' })
    expect(within(added).getByLabelText('New capital raised')).toBeTruthy()
    expect(within(rounds()).queryAllByLabelText('New capital raised')).toHaveLength(1)
  })

  it('quotes the pro-rata amount and holds ownership when you invest it', () => {
    open(EXAMPLE)
    const seriesA = within(rounds()).getByRole('article', { name: 'Series A' })
    expect(within(seriesA).getByText(/Amount required to keep your 0.10%/).textContent).toContain('€3,000')
    fireEvent.click(within(seriesA).getByRole('button', { name: 'Invest pro-rata' }))
    fireEvent.click(within(seriesA).getByRole('button', { name: 'Edit Series A' }))
    expect((within(seriesA).getByLabelText('Your follow-on investment') as HTMLInputElement).value).toBe('3,000')
    expect(within(seriesA).getByText('Pro-rata selected')).toBeTruthy()
    expect(within(seriesA).getAllByText('0.10%').length).toBeGreaterThan(0)
  })

  it('compares no follow-on, your follow-on and pro-rata side by side', () => {
    open(EXAMPLE)
    const seriesA = within(rounds()).getByRole('article', { name: 'Series A' })
    fireEvent.click(within(seriesA).getByRole('button', { name: 'Edit Series A' }))
    for (const title of ['No follow-on', 'Your follow-on', 'Maintain pro-rata']) {
      expect(within(seriesA).getByText(title)).toBeTruthy()
    }
    expect(within(seriesA).getByText('Required investment')).toBeTruthy()
  })

  it('adds a round and lets it take a custom name', () => {
    open()
    fireEvent.click(within(rounds()).getAllByRole('button', { name: '+ Add funding round' })[0] as HTMLElement)
    const added = within(rounds()).getByRole('article', { name: 'Series A' })
    fireEvent.change(within(added).getByLabelText('Round'), { target: { value: 'custom' } })
    fireEvent.change(within(rounds()).getByLabelText('Round name'), { target: { value: 'Bridge' } })
    expect(within(rounds()).getByRole('article', { name: 'Bridge' })).toBeTruthy()
  })
})

describe('the exit', () => {
  it('switches to a preset valuation in one click', () => {
    open(EXAMPLE)
    fireEvent.click(within(exit()).getByRole('radio', { name: '€100M' }))
    expect(within(exit()).getByText('Potential gross proceeds at a €100,000,000 exit')).toBeTruthy()
    expect(within(exit()).getAllByText('€51,200').length).toBeGreaterThan(0)
  })

  it('marks the exits where preferences can take priority, and shows a range when it is unclear', () => {
    open(EXAMPLE)
    const table = within(exit()).getByRole('table')
    expect(within(table).getByRole('rowheader', { name: /€10M \*/ })).toBeTruthy()
    expect(within(table).getByText('€5,000 – €25,600')).toBeTruthy()
    expect(within(table).queryByRole('rowheader', { name: /€250M \*/ })).toBeNull()
  })

  it('says the outcome is hypothetical', () => {
    open(EXAMPLE)
    expect(within(exit()).getByText(/are hypothetical scenarios .* not predictions/)).toBeTruthy()
  })
})

describe('the summary', () => {
  it('keeps the numbers that matter in one place', () => {
    open(EXAMPLE)
    const panel = within(summary())
    expect(panel.getByText('Initial ownership').nextSibling?.textContent).toBe('0.10%')
    expect(panel.getByText('Final ownership').nextSibling?.textContent).toBe('0.051%')
    expect(panel.getByText('Total invested').nextSibling?.textContent).toBe('€5,000')
  })
})

describe('explanations of financial terms', () => {
  it('open from the keyboard and close with Escape', () => {
    open(EXAMPLE)
    const button = within(rounds()).getAllByRole('button', { name: 'What is pro-rata?' })[0] as HTMLElement
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    const note = document.getElementById(button.getAttribute('aria-controls') as string) as HTMLElement
    expect(note.hidden).toBe(false)
    expect(note.textContent).toMatch(/keep your existing percentage ownership/)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('sharing', () => {
  it('copies a link that reopens exactly this calculation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    open(EXAMPLE)
    fireEvent.click(screen.getByRole('button', { name: 'Share calculation' }))
    expect(await screen.findByText(/Link copied/)).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(window.location.hash).toBe(`#s=${encodeScenario(EXAMPLE)}`)
  })
})
