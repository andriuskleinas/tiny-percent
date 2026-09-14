/**
 * The whole scenario, in one serialisable object. This is what travels in the
 * shared link, so its shape is a compatibility commitment rather than an
 * implementation detail. Bump `version` and migrate rather than changing a
 * field's meaning, or links people saved will silently decode into nonsense.
 *
 * Every money field is an integer number of cents. See `money.ts`.
 */

export type Currency = 'USD' | 'EUR'

/** A label only — every instrument converts identically at the round's valuation. */
export type InstrumentType = 'equity' | 'safe' | 'cla'

/** A cheque written into a round. Present on `Round.participation`. */
export interface Instrument {
  type: InstrumentType
  amountCents: number
  entryFee: EntryFeeTerms
}

/** The names offered in the round picker. Any other non-empty name is a custom round. */
export const ROUND_LABELS = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D'] as const
export type RoundLabel = (typeof ROUND_LABELS)[number]

export interface Round {
  id: string
  /** One of `ROUND_LABELS`, or a custom name. */
  label: string
  /** ISO 8601 date. */
  date: string
  raisedCents: number
  /** Meaning depends on `valuationBasis`. */
  valuationCents: number
  valuationBasis: 'pre' | 'post'
  /** New option pool created in this round, 0..1 of post-money. */
  newOptionPool?: number | undefined
  /** Undefined means sitting this round out. `rounds[0]` must always have one. */
  participation?: Instrument | undefined
}

/**
 * Fee terms are defined in `fees.ts` and re-exported here so the serialised
 * shape and the engine's shape cannot drift apart.
 */
import type { EntryFeeTerms, FeeTerms } from './fees'
export type { FeeTerms as Fees }

export interface ExitEvent {
  /** ISO 8601 date. */
  date: string
  valueCents: number
  /** Total capital the company has raised. Drives which exit regime applies. */
  totalRaisedCents: number
}

export interface Scenario {
  /** Bump to migrate links shared under an older shape. */
  version: 2
  /**
   * The one currency every amount in the scenario is in. There is deliberately
   * no per-round currency: mixing them needs exchange rates, and without them
   * euros and dollars would be added one for one.
   */
  currency: Currency
  /** `rounds[0]` is the entry — there is no separate top-level entry field. */
  rounds: Round[]
  fees: FeeTerms
  exit: ExitEvent
}
