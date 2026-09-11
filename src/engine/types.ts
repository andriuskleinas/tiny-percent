/**
 * The whole scenario, in one serialisable object. This is what travels in the
 * shared link, so its shape is a compatibility commitment rather than an
 * implementation detail. Bump `version` and migrate rather than changing a
 * field's meaning, or links people saved will silently decode into nonsense.
 *
 * Every money field is an integer number of cents. See `money.ts`.
 */

export type Currency = 'USD' | 'EUR' | 'GBP'

export type InstrumentType =
  | 'equity'
  | 'safe_post'
  | 'safe_pre'
  | 'cla'
  | 'asa'
  | 'kiss_equity'
  | 'kiss_debt'

export interface Instrument {
  type: InstrumentType
  amountCents: number
  /** ISO 8601 date. */
  date: string
  capCents?: number | undefined
  /** 0..1 */
  discount?: number | undefined
  /** 0..1, annual */
  interestRate?: number | undefined
  interestMode?: 'simple' | 'compound' | undefined
  maturityDate?: string | undefined
  /** Only meaningful for `safe_pre`, where the result is an estimate. */
  otherConvertingCents?: number | undefined
}

export type AngelAction =
  | { kind: 'sit_out' }
  | { kind: 'pro_rata' }
  | { kind: 'custom'; amountCents: number }

export interface Round {
  id: string
  label: string
  /** ISO 8601 date. */
  date: string
  raisedCents: number
  /** Post-money is always derived from this and the raise, never stored. */
  preMoneyCents: number
  /** New option pool created in this round, 0..1 of post-money. */
  newOptionPool?: number | undefined
  /** Whether the angel's convertible converts in this round. */
  convertsHere?: boolean | undefined
  angelAction: AngelAction
}

/**
 * Fee terms are defined in `fees.ts` and re-exported here so the serialised
 * shape and the engine's shape cannot drift apart.
 */
import type { FeeTerms } from './fees'
export type { FeeTerms as Fees }

export interface ExitEvent {
  /** ISO 8601 date. */
  date: string
  valueCents: number
  /** Total capital the company has raised. Drives which exit regime applies. */
  totalRaisedCents: number
  unconvertedLoan?: 'convert' | 'repay' | 'extend' | undefined
}

export interface Scenario {
  /** Bump to migrate links shared under an older shape. */
  version: 1
  currency: Currency
  entry: Instrument
  rounds: Round[]
  fees: FeeTerms
  exit: ExitEvent
}
