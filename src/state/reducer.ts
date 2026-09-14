import type { CarryTerms, ManagementFeeTerms } from '../engine/fees'
import type { Currency, ExitEvent, Instrument, Round, Scenario } from '../engine/types'

/**
 * One scenario object behind one reducer. No state library: there is exactly one
 * thing to hold, and it is the same object that travels in the shared link.
 *
 * `rounds[0]` is the entry, so there is no separate action for it — editing your
 * own investment and editing a follow-on go through the same `round:*` actions.
 */

export type Action =
  | { type: 'round:add' }
  | { type: 'round:remove'; id: string }
  | { type: 'round:set'; id: string; patch: Partial<Omit<Round, 'participation'>> }
  /** Creates the participation if it is absent, merges into it otherwise. */
  | { type: 'round:participate'; id: string; patch: Partial<Instrument> }
  /** Blocked for `rounds[0]` — you cannot skip your own entry. */
  | { type: 'round:sitOut'; id: string }
  | { type: 'exit:set'; patch: Partial<ExitEvent> }
  /** The whole scenario's currency. Amounts are relabelled, never converted. */
  | { type: 'currency:set'; currency: Currency }
  | { type: 'fees:carry'; patch: Partial<CarryTerms> }
  | { type: 'fees:management'; value: ManagementFeeTerms | undefined }

const LABELS: Round['label'][] = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+']

const NO_FEE = { rule: 'percent' as const, percent: 0 }

function nextRound(rounds: Round[]): Round {
  const last = rounds[rounds.length - 1]
  const year = last ? Number(last.date.slice(0, 4)) + 2 : new Date().getFullYear()
  const lastIndex = last ? LABELS.indexOf(last.label) : -1
  const nextLabel = LABELS[Math.min(lastIndex + 1, LABELS.length - 1)] as Round['label']
  return {
    id: `r${Date.now().toString(36)}`,
    label: nextLabel,
    date: `${year}-01-01`,
    // A sensible next round: three times the last post-money, raising a fifth of it.
    valuationCents: last ? (last.valuationCents + last.raisedCents) * 2 : 800_000_000,
    valuationBasis: 'pre',
    raisedCents: last ? Math.round((last.valuationCents + last.raisedCents) / 2) : 200_000_000,
  }
}

/** Total raised is the sum of the rounds unless the user has overridden it. */
export function impliedTotalRaised(rounds: Round[]): number {
  return rounds.reduce((sum, r) => sum + r.raisedCents, 0)
}

export function reducer(state: Scenario, action: Action): Scenario {
  switch (action.type) {
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

    case 'round:participate': {
      const rounds = state.rounds.map((r) => {
        if (r.id !== action.id) return r
        const participation = { ...(r.participation ?? { type: 'equity' as const, amountCents: 0, entryFee: NO_FEE }), ...action.patch }
        return { ...r, participation }
      })
      return { ...state, rounds }
    }

    case 'round:sitOut': {
      if (state.rounds[0]?.id === action.id) return state
      const rounds = state.rounds.map((r) => (r.id === action.id ? { ...r, participation: undefined } : r))
      return { ...state, rounds }
    }

    case 'exit:set':
      return { ...state, exit: { ...state.exit, ...action.patch } }

    case 'currency:set':
      return { ...state, currency: action.currency }

    case 'fees:carry':
      return { ...state, fees: { ...state.fees, carry: { ...state.fees.carry, ...action.patch } } }

    case 'fees:management':
      return { ...state, fees: { ...state.fees, management: action.value } }
  }
}
