import type { CarryTerms, EntryFeeTerms, ManagementFeeTerms } from '../engine/fees'
import type { ExitEvent, Instrument, Round, Scenario } from '../engine/types'

/**
 * One scenario object behind one reducer. No state library: there is exactly one
 * thing to hold, and it is the same object that travels in the shared link.
 */

export type Action =
  | { type: 'entry:set'; patch: Partial<Instrument> }
  | { type: 'round:add' }
  | { type: 'round:remove'; id: string }
  | { type: 'round:set'; id: string; patch: Partial<Round> }
  | { type: 'exit:set'; patch: Partial<ExitEvent> }
  | { type: 'fees:entry'; patch: Partial<EntryFeeTerms> }
  | { type: 'fees:carry'; patch: Partial<CarryTerms> }
  | { type: 'fees:management'; value: ManagementFeeTerms | undefined }
  | { type: 'scenario:replace'; scenario: Scenario }

const ORDINALS = ['Seed', 'Series A', 'Series B', 'Series C', 'Series D', 'Series E', 'Series F']

function nextRound(rounds: Round[]): Round {
  const last = rounds[rounds.length - 1]
  const year = last ? Number(last.date.slice(0, 4)) + 2 : new Date().getFullYear()
  return {
    id: `r${Date.now().toString(36)}`,
    label: ORDINALS[rounds.length] ?? `Round ${rounds.length + 1}`,
    date: `${year}-01-01`,
    // A sensible next round: three times the last post-money, raising a fifth of it.
    preMoneyCents: last ? (last.preMoneyCents + last.raisedCents) * 2 : 800_000_000,
    raisedCents: last ? Math.round((last.preMoneyCents + last.raisedCents) / 2) : 200_000_000,
    angelAction: { kind: 'sit_out' },
  }
}

/** Total raised is the sum of the rounds unless the user has overridden it. */
export function impliedTotalRaised(rounds: Round[]): number {
  return rounds.reduce((sum, r) => sum + r.raisedCents, 0)
}

export function reducer(state: Scenario, action: Action): Scenario {
  switch (action.type) {
    case 'entry:set':
      return { ...state, entry: { ...state.entry, ...action.patch } }

    case 'round:add': {
      const rounds = [...state.rounds, nextRound(state.rounds)]
      return { ...state, rounds, exit: { ...state.exit, totalRaisedCents: impliedTotalRaised(rounds) } }
    }

    case 'round:remove': {
      if (state.rounds.length <= 1) return state
      const rounds = state.rounds.filter((r) => r.id !== action.id)
      return { ...state, rounds, exit: { ...state.exit, totalRaisedCents: impliedTotalRaised(rounds) } }
    }

    case 'round:set': {
      const rounds = state.rounds.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r))
      const raiseChanged = 'raisedCents' in action.patch
      return {
        ...state,
        rounds,
        exit: raiseChanged
          ? { ...state.exit, totalRaisedCents: impliedTotalRaised(rounds) }
          : state.exit,
      }
    }

    case 'exit:set':
      return { ...state, exit: { ...state.exit, ...action.patch } }

    case 'fees:entry':
      return { ...state, fees: { ...state.fees, entry: { ...state.fees.entry, ...action.patch } } }

    case 'fees:carry':
      return { ...state, fees: { ...state.fees, carry: { ...state.fees.carry, ...action.patch } } }

    case 'fees:management':
      return { ...state, fees: { ...state.fees, management: action.value } }

    case 'scenario:replace':
      return action.scenario
  }
}
