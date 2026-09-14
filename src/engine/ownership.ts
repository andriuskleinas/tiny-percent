import { roundCents } from './money'

/**
 * A financing round, described the way an angel can actually describe one: how
 * much the company raised, at what pre-money, and whether a new option pool was
 * created alongside it.
 */
export interface RoundTerms {
  /** Pre-money valuation, in cents. Post-money is always derived, never stored. */
  preMoney: number
  /** Total raised in the round, in cents. Includes your own cheque. */
  raised: number
  /**
   * New option pool created in this round, as a fraction of post-money, carved
   * out of the pre-money in the standard way. Omit it when there is no top-up.
   */
  newOptionPool?: number | undefined
}

/**
 * Thrown when the requested option pool is at least as large as the pre-money
 * share of the company, which has no solution. Carries the numbers so the UI can
 * show the limit rather than repeating the message.
 */
export class PoolTooLargeError extends Error {
  readonly pool: number
  readonly limit: number

  constructor(pool: number, limit: number) {
    super(
      `An option pool of ${asPercent(pool)} of post-money is impossible in this round. ` +
        `The pre-money is only ${asPercent(limit)} of the post-money, ` +
        `so a new pool has to be smaller than that.`,
    )
    this.name = 'PoolTooLargeError'
    this.pool = pool
    this.limit = limit
  }
}

function asPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}

export function postMoney(terms: RoundTerms): number {
  return terms.preMoney + terms.raised
}

/**
 * What one unit of existing ownership is worth after the round, before any new
 * cheque. This is `P / V - t` from the plan, and it is the whole of dilution.
 */
function dilutionFactor(terms: RoundTerms): number {
  const pool = terms.newOptionPool ?? 0
  const limit = terms.preMoney / postMoney(terms)
  if (pool >= limit) throw new PoolTooLargeError(pool, limit)
  return limit - pool
}

/**
 * Ownership after a round. Pass `invested` to follow on, or leave it out to sit
 * out. Everything the calculator knows about dilution lives in this one line.
 */
export function ownAfter(ownBefore: number, terms: RoundTerms, invested = 0): number {
  // A round with no valuation yet is what a blank form looks like. It has an
  // answer only while there is nothing to price: no stake and no cheque.
  if (postMoney(terms) <= 0) {
    if (ownBefore === 0 && invested === 0) return 0
    throw new RangeError('Enter the company’s valuation to price this round.')
  }
  return ownBefore * dilutionFactor(terms) + invested / postMoney(terms)
}

/** Ownership bought by a first cheque into a round: the degenerate case of `ownAfter`. */
export function entryOwnership(invested: number, terms: RoundTerms): number {
  return ownAfter(0, terms, invested)
}

/**
 * The cheque that holds your position exactly. With a pool top-up you must fund
 * your share of the pool as well as your share of the round, which is why this
 * is not simply your percentage of the raise.
 */
export function proRata(ownBefore: number, terms: RoundTerms): number {
  dilutionFactor(terms) // validates the pool before quoting a price
  const pool = terms.newOptionPool ?? 0
  return roundCents(ownBefore * (terms.raised + pool * postMoney(terms)))
}

/** What a stake is worth at a given company valuation. */
export function stakeValue(ownership: number, valuation: number): number {
  return roundCents(ownership * valuation)
}

/**
 * The exit valuation above which writing the cheque beats keeping the cash.
 *
 * Setting `sit-out proceeds + the cash you kept` equal to `follow-on proceeds`
 * resolves to `E = I / (own_with - own_without)`, and that difference is exactly
 * `I / V`. So the break-even is the post-money you paid: your follow-on is under
 * water until the company is worth more than the round you bought into.
 *
 * Two consequences worth stating. It does not depend on your existing stake,
 * which is why that is not a parameter. And it is computed from the identity
 * rather than by subtracting the two ownerships, because that subtraction loses
 * precision for small cheques — a one-cent cheque into a $500M round comes out
 * roughly $40 low. `ownership.test.ts` checks the identity against the
 * subtraction so the derivation stays honest.
 *
 * Returned in cents, or undefined when the cheque buys nothing. Ignores fees and
 * liquidation preferences, which arrive in phase 03.
 */
export function followOnBreakEven(terms: RoundTerms, invested: number): number | undefined {
  if (invested <= 0) return undefined
  dilutionFactor(terms) // validates the round before quoting a number
  return postMoney(terms)
}
