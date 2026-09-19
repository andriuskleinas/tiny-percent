/**
 * The whole scenario, in one serialisable object. This is what travels in the
 * shared link, so its shape is a compatibility commitment rather than an
 * implementation detail. Bump `version` and migrate rather than changing a
 * field's meaning, or links people saved will silently decode into nonsense.
 *
 * Every money field is an integer number of cents. See `money.ts`.
 */

export type Currency = 'USD' | 'EUR'

/**
 * Priced shares, a SAFE, or a convertible loan note. Only the entry cheque can be
 * a SAFE or note; later rounds are priced, and a cheque into one buys shares
 * whatever its type says. See `convert.ts` for how a SAFE or note converts.
 */
export type InstrumentType = 'equity' | 'safe' | 'cla'

export type InterestMode = 'simple' | 'compound'

/** A cheque written into a round. Present on `Round.participation`. */
export interface Instrument {
  type: InstrumentType
  amountCents: number
  entryFee: EntryFeeTerms
  /** SAFE or note: 0..1 off the price of the round it converts in. */
  discount?: number | undefined
  /** Note only: 0..1 a year, accrued from the entry date to conversion. */
  interestRate?: number | undefined
  /** Note only. Defaults to simple. */
  interestMode?: InterestMode | undefined
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
  /**
   * Meaning depends on `valuationBasis`. When the entry is a SAFE or note, this is
   * its valuation cap, the basis is the cap's basis, and `raisedCents` is everyone
   * investing on those terms, you included.
   */
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
  version: 3
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
