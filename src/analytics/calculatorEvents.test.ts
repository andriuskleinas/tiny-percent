import { describe, expect, it } from 'vitest'
import { toCents } from '../engine/money'
import { EXAMPLE, STARTING_POINT, blankScenario } from '../state/presets'
import { reducer } from '../state/reducer'
import type { Action } from '../state/reducer'
import type { Scenario } from '../engine/types'
import { calculatorEvents, createJourney } from './calculatorEvents'

/**
 * Which funnel events a calculator change produces. Pure: previous scenario,
 * action, next scenario and what this visit has already done in, events out.
 */

function play(start: Scenario, actions: Action[]) {
  const journey = createJourney()
  let scenario = start
  const names: string[] = []
  for (const action of actions) {
    const next = reducer(scenario, action)
    for (const event of calculatorEvents(scenario, action, next, journey)) names.push(event.name)
    scenario = next
  }
  return names
}

const entryId = (s: Scenario) => s.rounds[0]?.id as string

describe('calculator funnel events', () => {
  it('starts, takes the investment, and reaches ownership — which is activation', () => {
    const blank = blankScenario('EUR', new Date('2026-09-14'))
    const id = entryId(blank)
    expect(
      play(blank, [
        { type: 'round:participate', id, patch: { amountCents: toCents(5_000) } },
        { type: 'round:set', id, patch: { valuationCents: toCents(4_000_000) } },
        { type: 'round:set', id, patch: { raisedCents: toCents(1_000_000) } },
      ]),
    ).toEqual(['calculator_started', 'initial_investment_entered', 'ownership_calculated', 'activated'])
  })

  it('counts editing the default investment as reaching ownership', () => {
    expect(play(STARTING_POINT, [{ type: 'round:participate', id: 'seed', patch: { amountCents: toCents(10_000) } }])).toEqual([
      'calculator_started',
      'initial_investment_entered',
      'ownership_calculated',
      'activated',
    ])
  })

  it('reports each round added, and the second one separately', () => {
    const names = play(STARTING_POINT, [
      { type: 'round:add', id: 'a' },
      { type: 'round:add', id: 'b' },
      { type: 'round:add', id: 'c' },
    ])
    expect(names.filter((n) => n === 'funding_round_added')).toHaveLength(3)
    expect(names.filter((n) => n === 'second_funding_round_added')).toHaveLength(1)
  })

  it('reports a follow-on amount once per round, not once per keystroke', () => {
    const names = play(EXAMPLE, [
      { type: 'round:participate', id: 'series-a', patch: { amountCents: toCents(1) } },
      { type: 'round:participate', id: 'series-a', patch: { amountCents: toCents(10) } },
      { type: 'round:participate', id: 'series-b', patch: { amountCents: toCents(100) } },
    ])
    expect(names.filter((n) => n === 'follow_on_amount_entered')).toHaveLength(2)
  })

  it('says whether a follow-on amount is exactly the pro-rata amount', () => {
    const journey = createJourney()
    const action: Action = { type: 'round:participate', id: 'series-a', patch: { amountCents: toCents(3_000), type: 'equity', entryFee: { rule: 'percent', percent: 0 } } }
    const [event] = calculatorEvents(EXAMPLE, action, reducer(EXAMPLE, action), journey).filter((e) => e.name === 'follow_on_amount_entered')
    expect(event).toEqual({ name: 'follow_on_amount_entered', pro_rata: true })
  })

  it('completes an exit scenario when the valuation changes, and strong activation needs all three steps', () => {
    const names = play(STARTING_POINT, [
      { type: 'round:participate', id: 'seed', patch: { amountCents: toCents(6_000) } },
      { type: 'round:add', id: 'a' },
      { type: 'exit:set', patch: { valueCents: toCents(250_000_000) } },
    ])
    expect(names).toContain('exit_valuation_changed')
    expect(names).toContain('exit_scenario_completed')
    expect(names.at(-1)).toBe('strongly_activated')
  })

  it('does not strongly activate without a later round', () => {
    const names = play(STARTING_POINT, [
      { type: 'round:participate', id: 'seed', patch: { amountCents: toCents(6_000) } },
      { type: 'exit:set', patch: { valueCents: toCents(250_000_000) } },
    ])
    expect(names).not.toContain('strongly_activated')
  })

  it('treats loading the example as a load, not as the user starting', () => {
    expect(play(STARTING_POINT, [{ type: 'scenario:load', scenario: EXAMPLE }])).toEqual([])
  })

  it('never puts an amount, valuation or ownership into an event', () => {
    const journey = createJourney()
    const actions: Action[] = [
      { type: 'round:participate', id: 'seed', patch: { amountCents: toCents(6_000) } },
      { type: 'round:add', id: 'a' },
      { type: 'round:participate', id: 'a', patch: { amountCents: toCents(3_000) } },
      { type: 'exit:set', patch: { valueCents: toCents(100_000_000) } },
    ]
    let scenario = STARTING_POINT
    for (const action of actions) {
      const next = reducer(scenario, action)
      for (const event of calculatorEvents(scenario, action, next, journey)) {
        const { name: _name, ...props } = event
        expect(Object.keys(props).join(' ')).not.toMatch(/cents|amount|valuation|ownership|email/i)
        for (const value of Object.values(props)) {
          if (typeof value === 'number') expect(value).toBeLessThan(100)
        }
      }
      scenario = next
    }
  })
})
