// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import type { Scenario } from '../engine/types'
import { toCents } from '../engine/money'
import { EXAMPLE } from '../state/presets'
import { positionOf, stepExit } from './exitScale'
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
const exit = () => screen.getByRole('region', { name: 'What could it be worth?' })
const summary = () => screen.getByRole('region', { name: 'Your investment summary' })
const chart = () => screen.getByRole('region', { name: 'Follow on or sit out?' })
const slider = () => within(exit()).getByRole('slider', { name: 'Exit valuation' }) as HTMLInputElement
const slideTo = (major: number) =>
  fireEvent.change(slider(), { target: { value: String(positionOf(toCents(major))) } })
const summaryValue = (label: string | RegExp) => within(summary()).getByText(label).nextSibling?.textContent

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

  it('groups an amount into thousands while it is being typed', () => {
    open()
    const field = within(investment()).getByLabelText('Company valuation') as HTMLInputElement
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: '48000000' } })
    expect(field.value).toBe('48,000,000')
    fireEvent.change(field, { target: { value: '4m' } })
    expect(field.value).toBe('4m')
    expect(within(investment()).getByText('= €4,000,000')).toBeTruthy()
  })

  it('rewrites a typed amount with thousands separators once you leave the field', () => {
    open()
    const field = within(investment()).getByLabelText('Company valuation') as HTMLInputElement
    fireEvent.change(field, { target: { value: '24000000' } })
    fireEvent.blur(field)
    expect(field.value).toBe('24,000,000')
  })
})

describe('the calculator’s controls', () => {
  it('has no toolbar: no start from scratch, load example or share buttons', () => {
    open()
    for (const name of ['Start from scratch', 'Load example', 'Share calculation']) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
    expect(screen.queryByText('More terms: instrument, option pool, fees')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Run your own numbers' })).toBeTruthy()
  })

  it('lets you pick the round you invest in, or name another', () => {
    open()
    const rounds = within(investment()).getByRole('radiogroup', { name: 'Funding round' })
    expect(within(rounds).getByRole('radio', { name: 'Seed' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(rounds).getByRole('radio', { name: 'Pre-seed' }))
    expect(within(rounds).getByRole('radio', { name: 'Pre-seed' }).getAttribute('aria-checked')).toBe('true')
    expect(within(summary()).getByText('Initial investment (Pre-seed)')).toBeTruthy()
    fireEvent.click(within(rounds).getByRole('radio', { name: 'Other' }))
    fireEvent.change(within(investment()).getByLabelText('Round name'), { target: { value: 'Angel round' } })
    expect(within(summary()).getByText('Initial investment (Angel round)')).toBeTruthy()
  })

  it('explains a round it cannot price instead of blanking the page', () => {
    open()
    fireEvent.change(within(investment()).getByLabelText('Company valuation'), { target: { value: '' } })
    fireEvent.change(within(investment()).getByLabelText('Amount raised'), { target: { value: '' } })
    expect(screen.getByText(/Enter the company’s valuation to price this round/)).toBeTruthy()
    expect(slider()).toBeTruthy()
    fireEvent.change(within(investment()).getByLabelText('Company valuation'), { target: { value: '4m' } })
    fireEvent.change(within(investment()).getByLabelText('Amount raised'), { target: { value: '1m' } })
    expect(within(investment()).getByText('0.10%')).toBeTruthy()
  })
})

describe('a single cheque with no later rounds', () => {
  const curve = () => screen.getByRole('region', { name: 'From cheque to exit' })

  it('draws what the cheque returns at every exit, and moves with the slider', () => {
    open()
    expect(screen.queryByRole('region', { name: 'Follow on or sit out?' })).toBeNull()
    const stats = within(curve())
    expect(stats.getByText('Net at a €100M exit').nextSibling?.textContent).toBe('€100,000')
    expect(stats.getByText('Multiple').nextSibling?.textContent).toBe('20×')
    expect(stats.getByText(/You get your money back from about a €5M exit/)).toBeTruthy()
    slideTo(20_000_000)
    expect(within(curve()).getByText('Net at a €20M exit').nextSibling?.textContent).toBe('€20,000')
  })

  it('gives way to the follow-on comparison once a round is added', () => {
    open()
    expect(within(rounds()).getAllByRole('button', { name: '+ Add funding round' })).toHaveLength(1)
    fireEvent.click(within(rounds()).getByRole('button', { name: '+ Add funding round' }))
    expect(screen.queryByRole('region', { name: 'From cheque to exit' })).toBeNull()
    expect(chart()).toBeTruthy()
  })
})

describe('a loaded example', () => {
  it('shows the €5,000 example diluted to 0.051%, €128,000 and 25.6× at a €250M exit', () => {
    open(EXAMPLE)
    const table = within(screen.getByRole('region', { name: 'Your stake, round by round' })).getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(6)
    expect(within(table).getByRole('rowheader', { name: /Series C/ })).toBeTruthy()
    expect(slider().getAttribute('aria-valuetext')).toBe('€250,000,000')
    expect(summaryValue('Gross proceeds')).toBe('€128,000')
    expect(summaryValue('Net proceeds')).toBe('€128,000')
    expect(summaryValue(/^Multiple/)).toBe('25.6×')
    expect(summaryValue('Final ownership')).toBe('0.051%')
  })
})

describe('future rounds and the follow-on choice', () => {
  it('shows every round’s terms in its card, with a bin to remove it', () => {
    open(EXAMPLE)
    const seriesB = within(rounds()).getByRole('article', { name: 'Series B' })
    expect(within(seriesB).getByLabelText('Amount raised')).toBeTruthy()
    expect(within(seriesB).queryByRole('button', { name: /^(Edit|Done)/ })).toBeNull()
    expect(within(seriesB).queryByLabelText('New option pool')).toBeNull()
    fireEvent.click(within(seriesB).getByRole('button', { name: 'Remove Series B' }))
    expect(within(rounds()).queryByRole('article', { name: 'Series B' })).toBeNull()
    expect(summaryValue('Final ownership')).toBe('0.064%')
  })

  it('ends the round-by-round table with the exit set on the slider', () => {
    open(EXAMPLE)
    const table = () => within(screen.getByRole('region', { name: 'Your stake, round by round' })).getByRole('table')
    const exitRow = () => within(table()).getByRole('rowheader', { name: /^Exit at/ }).parentElement as HTMLElement
    expect(exitRow().textContent).toContain('Exit at €250M')
    expect(exitRow().textContent).toContain('€250,000,000')
    expect(exitRow().textContent).toContain('0.051%')
    expect(exitRow().textContent).toContain('25.6×')
    expect(exitRow().textContent).toContain('€128,000')
    slideTo(100_000_000)
    expect(exitRow().textContent).toContain('Exit at €100M')
    expect(exitRow().textContent).toContain('€51,200')
    fireEvent.change(within(exit()).getByLabelText('Carry'), { target: { value: '20' } })
    expect(exitRow().textContent).toContain('€41,960 after 20% carry')
  })

  it('keeps the round-by-round table below the chart, not in the rounds', () => {
    open(EXAMPLE)
    expect(within(rounds()).queryByRole('table')).toBeNull()
    const section = screen.getByRole('region', { name: 'Your stake, round by round' })
    expect(chart().compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('opens a round you have just added', () => {
    open(EXAMPLE)
    fireEvent.click(within(rounds()).getByRole('button', { name: '+ Add funding round' }))
    const added = within(rounds()).getByRole('article', { name: 'Series D' })
    expect(within(added).getByLabelText('Amount raised')).toBeTruthy()
  })

  it('quotes the pro-rata amount and holds ownership when you invest it', () => {
    open(EXAMPLE)
    const seriesA = within(rounds()).getByRole('article', { name: 'Series A' })
    expect(within(seriesA).getByText(/Your pro-rata is/).textContent).toContain('€3,000')
    const proRata = within(seriesA).getByRole('radio', { name: 'Invest pro-rata, €3,000' })
    fireEvent.click(proRata)
    expect(proRata.getAttribute('aria-checked')).toBe('true')
    expect(seriesA.textContent).toContain('you invest €3,000')
    expect(within(seriesA).getAllByText('0.10%').length).toBeGreaterThan(0)
  })

  it('shows what each choice leaves you with before you make it', () => {
    open(EXAMPLE)
    const seriesA = within(rounds()).getByRole('article', { name: 'Series A' })
    const none = within(seriesA).getByRole('radio', { name: 'Don’t participate in Series A' })
    expect(none.getAttribute('aria-checked')).toBe('true')
    expect(none.textContent).toContain('0.080%')
    expect(none.textContent).toContain('€12,000')
    expect(none.textContent).toContain('−20.0% of your share')
    const proRata = within(seriesA).getByRole('radio', { name: 'Invest pro-rata, €3,000' })
    expect(proRata.textContent).toContain('0.10%')
    expect(proRata.textContent).toContain('€15,000')
  })

  it('asks for a decision on a round you add, and takes an amount or “don’t participate”', () => {
    open(EXAMPLE)
    fireEvent.click(within(rounds()).getByRole('button', { name: '+ Add funding round' }))
    const added = within(rounds()).getByRole('article', { name: 'Series D' })
    expect(within(added).getByRole('status').textContent).toBe('Decision needed')
    const decision = within(within(added).getByRole('radiogroup', { name: 'Do you invest in Series D?' }))
    expect(decision.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(screen.getByText(/Decide whether you invest in Series D/)).toBeTruthy()

    fireEvent.click(within(added).getByRole('radio', { name: 'Invest another amount' }))
    expect(within(added).queryByRole('status')).toBeNull()
    expect(within(added).getByText(/Enter the amount you invest/)).toBeTruthy()
    fireEvent.change(within(added).getByLabelText('Your follow-on investment'), { target: { value: '10k' } })
    expect(added.textContent).toContain('you invest €10,000')
    expect(summaryValue('Follow-on investments')).toBe('€10,000')
    expect(within(chart()).getByRole('rowheader', { name: /^Series D/ }).parentElement?.textContent).toContain('cheque €10,000')
    expect(within(added).getByText(/% of your pro-rata/)).toBeTruthy()

    fireEvent.click(within(added).getByRole('radio', { name: 'Don’t participate in Series D' }))
    expect(added.textContent).toContain('you don’t participate')
    expect(within(added).queryByLabelText('Your follow-on investment')).toBeNull()
  })

  it('adds a round and lets it take a custom name', () => {
    open()
    fireEvent.click(within(rounds()).getByRole('button', { name: '+ Add funding round' }))
    const added = within(rounds()).getByRole('article', { name: 'Series A' })
    const other = within(added).getByRole('option', { name: 'Other…' }) as HTMLOptionElement
    fireEvent.change(within(added).getByLabelText('Round'), { target: { value: other.value } })
    const name = within(rounds()).getByLabelText('Round name') as HTMLInputElement
    expect(name.value).toBe('')
    fireEvent.change(name, { target: { value: 'Bridge' } })
    expect(within(rounds()).getByRole('article', { name: 'Bridge' })).toBeTruthy()
  })

  it('offers a name typed for one round in the next round’s list', () => {
    open()
    fireEvent.click(within(within(investment()).getByRole('radiogroup', { name: 'Funding round' })).getByRole('radio', { name: 'Other' }))
    const entryName = within(investment()).getByLabelText('Round name') as HTMLInputElement
    expect(entryName.value).toBe('')
    fireEvent.change(entryName, { target: { value: 'Angel round' } })
    fireEvent.click(within(rounds()).getByRole('button', { name: '+ Add funding round' }))
    const added = within(rounds()).getByRole('article', { name: 'Series A' })
    expect(within(added).queryByRole('option', { name: /Custom/ })).toBeNull()
    fireEvent.change(within(added).getByLabelText('Round'), { target: { value: 'Angel round' } })
    expect(within(rounds()).getByRole('article', { name: 'Angel round' })).toBeTruthy()
    expect(within(rounds()).queryByLabelText('Round name')).toBeNull()
  })
})

describe('the follow-on chart', () => {
  const cellsFor = (point: RegExp) => {
    const row = within(chart()).getByRole('rowheader', { name: point }).parentElement as HTMLElement
    return within(row).getAllByRole('cell').map((cell) => cell.textContent ?? '')
  }

  it('sits below the calculator and compares no follow-on, your choices and pro-rata', () => {
    open(EXAMPLE)
    const [sitOut, yours, proRata] = cellsFor(/^Exit €250M$/)
    expect(sitOut).toContain('invested €5,000; owns 0.051%; net proceeds €128,000')
    expect(proRata).toContain('invested €36,000; owns 0.10%; net proceeds €250,000')
    expect(yours).toContain('net proceeds €128,000')
    for (const title of ['No follow-on', 'Your choices', 'Always pro-rata']) {
      expect(within(chart()).getByRole('listitem', { name: title })).toBeTruthy()
    }
    expect(within(chart()).getByText(/paying your pro-rata every round costs/).textContent).toMatch(
      /€31,000 more .* €122,000 more — 3.94× on the extra money/,
    )
  })

  it('moves your line with your decisions', () => {
    open(EXAMPLE)
    expect(cellsFor(/^Series A 2027$/)[1]).toContain('cheque none')
    const seriesA = within(rounds()).getByRole('article', { name: 'Series A' })
    fireEvent.click(within(seriesA).getByRole('radio', { name: 'Invest pro-rata, €3,000' }))
    expect(cellsFor(/^Series A 2027$/)[1]).toContain('cheque €3,000; invested €8,000; owns 0.10%')
    expect(cellsFor(/^Series A 2027$/)[2]).toContain('cheque €3,000')
  })

  it('switches between stake value and ownership', () => {
    open(EXAMPLE)
    const views = within(chart()).getByRole('radiogroup', { name: 'Chart shows' })
    fireEvent.click(within(views).getByRole('radio', { name: 'Ownership' }))
    expect(within(views).getByRole('radio', { name: 'Ownership' }).getAttribute('aria-checked')).toBe('true')
    expect(within(chart()).getByRole('img').getAttribute('aria-label')).toMatch(/^Ownership by round/)
  })

  it('reflects carry in every path’s exit figures', () => {
    open(EXAMPLE)
    fireEvent.change(within(exit()).getByLabelText('Carry'), { target: { value: '20' } })
    expect(cellsFor(/^Exit €250M$/)[0]).toContain('net proceeds €103,400')
  })
})

describe('the exit and the summary', () => {
  it('changes the exit by sliding, and the summary follows', () => {
    open(EXAMPLE)
    slideTo(100_000_000)
    expect(slider().getAttribute('aria-valuetext')).toBe('€100,000,000')
    expect(within(summary()).getByText('If the company sells for €100M')).toBeTruthy()
    expect(summaryValue('Net proceeds')).toBe('€51,200')
    expect(summaryValue(/^Multiple/)).toBe('10.2×')
  })

  it('lands on half-million exits, and steps by €0.5M with the arrow keys', () => {
    open(EXAMPLE)
    slideTo(7_500_000)
    expect(slider().getAttribute('aria-valuetext')).toBe('€7,500,000')
    fireEvent.keyDown(slider(), { key: 'ArrowRight' })
    expect(slider().getAttribute('aria-valuetext')).toBe('€8,000,000')
    fireEvent.keyDown(slider(), { key: 'ArrowLeft' })
    fireEvent.keyDown(slider(), { key: 'ArrowLeft' })
    expect(slider().getAttribute('aria-valuetext')).toBe('€7,000,000')
    expect(stepExit(toCents(7_000_000), 1)).toBe(toCents(7_500_000))
  })

  it('shows a range, and says why, where liquidation preferences decide the outcome', () => {
    open(EXAMPLE)
    slideTo(50_000_000)
    expect(summaryValue('Gross proceeds')).toBe('€5,000 – €25,600')
    expect(within(summary()).getByText(/liquidation preferences decide where in this range you land/)).toBeTruthy()
  })

  it('takes carry off the proceeds', () => {
    open(EXAMPLE)
    fireEvent.change(within(exit()).getByLabelText('Carry'), { target: { value: '20' } })
    expect(summaryValue('Carry (20%)')).toBe('−€24,600')
    expect(summaryValue('Net proceeds')).toBe('€103,400')
    expect(summaryValue(/^Multiple/)).toBe('20.7×')
  })

  it('lets carry be cleared and retyped instead of snapping back to zero', () => {
    open(EXAMPLE)
    const carry = within(exit()).getByLabelText('Carry') as HTMLInputElement
    fireEvent.focus(carry)
    fireEvent.change(carry, { target: { value: '20' } })
    fireEvent.change(carry, { target: { value: '' } })
    expect(carry.value).toBe('')
    expect(summaryValue('Net proceeds')).toBe('€128,000')
    fireEvent.change(carry, { target: { value: '15' } })
    expect(carry.value).toBe('15')
    expect(summaryValue('Carry (15%)')).toBe('−€18,450')
    fireEvent.change(carry, { target: { value: '80' } })
    expect(within(exit()).getByText('Enter a percentage from 0 to 50.')).toBeTruthy()
    expect(summaryValue('Carry (15%)')).toBe('−€18,450')
    fireEvent.blur(carry)
    expect(carry.value).toBe('15')
  })

  it('counts the rounds you add and the follow-ons you write', () => {
    open(EXAMPLE)
    expect(summaryValue('Initial ownership')).toBe('0.10%')
    fireEvent.click(within(rounds()).getByRole('button', { name: '+ Add funding round' }))
    expect(summaryValue('Final ownership')).toBe('0.041%')
    const seriesA = within(rounds()).getByRole('article', { name: 'Series A' })
    fireEvent.click(within(seriesA).getByRole('radio', { name: 'Invest pro-rata, €3,000' }))
    expect(summaryValue('Follow-on investments')).toBe('€3,000')
    expect(summaryValue('Total invested')).toBe('€8,000')
  })

  it('says the outcome is hypothetical', () => {
    open(EXAMPLE)
    expect(within(summary()).getByText('Hypothetical, not a forecast.')).toBeTruthy()
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
