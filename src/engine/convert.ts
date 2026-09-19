import { roundCents } from './money'
import { dilutionFactor, postMoney } from './ownership'
import type { RoundTerms } from './ownership'
import type { Instrument, InstrumentType, InterestMode, Round } from './types'

/**
 * A SAFE or convertible note buys no shares when it is signed. It converts at the
 * next priced round at the best of three prices: the valuation cap, the round
 * price less the discount, and the round price itself. You get one of them,
 * never a blend.
 *
 * The three do not treat a new option pool alike. The cap fixes a share of the
 * capitalisation before the round (the post-money SAFE excludes the pool top-up
 * from it), so the new pool dilutes it like any existing holder. The two price
 * routes buy fully diluted shares at a price that already has the pool inside
 * the pre-money, so it does not. Comparing "effective valuations" would therefore
 * pick the wrong route whenever there is a pool; this compares the ownership each
 * route ends with, which is what the angel actually gets. With no pool the two
 * comparisons agree. `tools/oracle.py` checks every route against a share ledger.
 */

export type ConversionRoute = 'cap' | 'discount' | 'round_price'

export interface Conversion {
  route: ConversionRoute
  /** Ownership once the round has closed, before any cheque written into it. */
  ownership: number
  /**
   * The stake that round dilutes to `ownership`: `ownership / (P/V - pool)`. It
   * is what a follow-on cheque in the same round adds to, and what pro-rata is
   * quoted on. For the cap route it is the stake at conversion.
   */
  stake: number
  /** Principal plus accrued interest — what actually converts. */
  convertingCents: number
  /** Interest only. Never counted as money you paid. */
  accruedCents: number
  /** The cap as a post-money figure. A pre-money cap adds everything converting. */
  capPostCents: number
  /** True for a pre-money cap, which depends on other SAFEs the angel cannot see. */
  estimate: boolean
}

export function isConvertible(type: InstrumentType): boolean {
  return type !== 'equity'
}

/**
 * Simple interest is charged on the principal alone; compounding charges it on
 * the interest too. Both are in the market, so neither is assumed.
 */
export function accrue(principalCents: number, rate: number, years: number, mode: InterestMode = 'simple'): number {
  if (rate <= 0 || years <= 0) return principalCents
  const factor = mode === 'simple' ? 1 + rate * years : (1 + rate) ** years
  return roundCents(principalCents * factor)
}

const MS_PER_DAY = 86_400_000
const DAYS_PER_YEAR = 365

/** Actual/365, the convention most convertible loan agreements use. */
export function yearsBetween(startIso: string, endIso: string): number {
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new RangeError(`Cannot read "${startIso}" or "${endIso}" as a date.`)
  }
  return Math.max(0, (end - start) / MS_PER_DAY / DAYS_PER_YEAR)
}

function fraction(value: number | undefined, what: string, below1 = false): number {
  const v = value ?? 0
  if (!Number.isFinite(v) || v < 0 || v > 1 || (below1 && v >= 1)) {
    throw new RangeError(`${what} has to be between 0% and ${below1 ? 'just under ' : ''}100%.`)
  }
  return v
}

/**
 * How the entry cheque converts in `round`, the first round after it.
 *
 * `entry` is the entry round: its valuation is the cap, its basis the cap's
 * basis, and its amount raised everyone investing on these terms. A pre-money
 * cap converts against the capitalisation before any SAFE converts, so every
 * SAFE converting alongside dilutes the others; that works out as a post-money
 * cap of `cap + converting + others`, and it is an estimate because the angel
 * cannot see the others.
 */
export function convertAt(entry: Round, cheque: Instrument, round: Round, terms: RoundTerms): Conversion {
  const discount = fraction(cheque.discount, 'A discount', true)
  const rate = cheque.type === 'cla' ? fraction(cheque.interestRate, 'An interest rate') : 0
  const convertingCents =
    rate > 0 ? accrue(cheque.amountCents, rate, yearsBetween(entry.date, round.date), cheque.interestMode ?? 'simple') : cheque.amountCents
  const accruedCents = convertingCents - cheque.amountCents

  const estimate = entry.valuationBasis === 'pre'
  const others = Math.max(0, entry.raisedCents - cheque.amountCents)
  const capPostCents = estimate ? entry.valuationCents + convertingCents + others : entry.valuationCents
  if (!(capPostCents > 0)) throw new RangeError('Enter the valuation cap to see what your SAFE converts into.')

  const value = postMoney(terms)
  const retained = dilutionFactor(terms)
  const routes: Array<{ route: ConversionRoute; ownership: number }> = [
    { route: 'cap', ownership: (convertingCents / capPostCents) * retained },
  ]
  if (discount > 0) routes.push({ route: 'discount', ownership: convertingCents / ((1 - discount) * value) })
  routes.push({ route: 'round_price', ownership: convertingCents / value })

  // The best ownership wins outright. Ties stay with the earlier route, the cap.
  let best = routes[0] as (typeof routes)[number]
  for (const candidate of routes) if (candidate.ownership > best.ownership) best = candidate

  const stake = best.ownership / retained
  if (!(stake < 1)) {
    throw new RangeError(
      `${round.label}: the ${cheque.type === 'cla' ? 'note' : 'SAFE'} would convert into the whole company at this price. ` +
        'Check the cap and the round’s valuation.',
    )
  }
  return { route: best.route, ownership: best.ownership, stake, convertingCents, accruedCents, capPostCents, estimate }
}
