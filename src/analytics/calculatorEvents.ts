import type { Scenario } from '../engine/types'
import { entryIsComplete } from '../ui/facts'
import { safeRun } from '../ui/safeRun'
import { EXIT_PRESETS_CENTS } from '../state/presets'
import type { Action } from '../state/reducer'
import type { AnalyticsEvent } from './track'

/**
 * What one calculator change means for the funnel. Pure, so the whole journey
 * can be tested without a page: the previous scenario, the action, the next
 * scenario, and a record of what this visit has already done.
 *
 * Loading a scenario (the example, a blank form) is not the user calculating
 * anything, so it produces no calculator events; the buttons that load it
 * report themselves.
 */

export interface Journey {
  /** Once-per-visit events already sent. */
  sent: Set<AnalyticsEvent['name']>
  /** Rounds whose follow-on amount has been reported, so typing is not counted per keystroke. */
  followOnRounds: Set<string>
  roundAdded: boolean
}

export function createJourney(): Journey {
  return { sent: new Set(), followOnRounds: new Set(), roundAdded: false }
}

export function calculatorEvents(prev: Scenario, action: Action, next: Scenario, journey: Journey): AnalyticsEvent[] {
  if (action.type === 'scenario:load' || next === prev) return []

  const events: AnalyticsEvent[] = []
  const once = (event: AnalyticsEvent) => {
    if (journey.sent.has(event.name)) return
    journey.sent.add(event.name)
    events.push(event)
  }

  once({ name: 'calculator_started' })

  const entry = next.rounds[0]
  const isEntry = 'id' in action && action.id === entry?.id

  if (action.type === 'round:participate' && isEntry && (action.patch.amountCents ?? 0) > 0) {
    once({ name: 'initial_investment_entered' })
  }

  const touchesEntry = isEntry && (action.type === 'round:participate' || action.type === 'round:set')
  if (touchesEntry && entry && entryIsComplete(entry)) {
    once({ name: 'ownership_calculated' })
    once({ name: 'activated' })
  }

  if (action.type === 'round:add') {
    journey.roundAdded = true
    const followOns = next.rounds.length - 1
    events.push({ name: 'funding_round_added', rounds: Math.min(followOns, 99) })
    if (followOns >= 2) once({ name: 'second_funding_round_added' })
  }

  if (action.type === 'round:participate' && !isEntry && (action.patch.amountCents ?? 0) > 0 && !journey.followOnRounds.has(action.id)) {
    journey.followOnRounds.add(action.id)
    const state = safeRun(next).run?.rounds.find((r) => r.round.id === action.id)
    events.push({ name: 'follow_on_amount_entered', pro_rata: state !== undefined && state.investedCents === state.proRataCents })
  }

  if (action.type === 'exit:set' && action.patch.valueCents !== undefined) {
    events.push({ name: 'exit_valuation_changed', preset: EXIT_PRESETS_CENTS.includes(action.patch.valueCents) })
    if (action.patch.valueCents > 0 && entry && entryIsComplete(entry)) once({ name: 'exit_scenario_completed' })
  }

  // §31: ownership reached, at least one later round added, and an exit explored — in any order.
  if (journey.sent.has('activated') && journey.roundAdded && journey.sent.has('exit_scenario_completed')) {
    once({ name: 'strongly_activated' })
  }

  return events
}
