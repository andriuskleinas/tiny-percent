import { roundCents } from './money'
import { postMoney } from './ownership'
import type { RoundTerms } from './ownership'
import type { InstrumentType } from './types'

/**
 * Every instrument an angel can hold, through one formula.
 *
 *   converting   = amount * interest_factor
 *   effective_V  = min(cap * V / P, V * (1 - discount))
 *   ownership    = converting / effective_V
 *
 * Priced equity is the degenerate case with no cap, no discount and no interest,
 * where this collapses to `amount / V`. Six labels, three paths, one formula.
 */

export type InstrumentPath = 'priced' | 'convertible' | 'accruing'
export type CapBasis = 'pre' | 'post'
export type InterestMode = 'simple' | 'compound'
/** Which of the two alternatives actually set the price. Never a blend. */
export type ConversionRoute = 'cap' | 'discount' | 'round_price'

export interface ConvertibleInput {
  type: InstrumentType
  /** What you actually paid, in cents. Interest is added on top of this. */
  amountCents: number
  capCents?: number | undefined
  /** Defaults from the type. Only `safe_pre` is a pre-money cap by default. */
  capBasis?: CapBasis | undefined
  /** 0..1 off the round price. */
  discount?: number | undefined
  /** 0..1 annual. Ignored by instruments that do not accrue. */
  interestRate?: number | undefined
  interestMode?: InterestMode | undefined
  /** Years from investment to conversion. Use `yearsBetween` for real dates. */
  years?: number | undefined
  /**
   * Total of other instruments converting in the same round. Only affects
   * pre-money caps, where everything converting dilutes everything else. You
   * usually cannot see this number, which is why the result is an estimate.
   */
  otherConvertingCents?: number | undefined
}

export interface Conversion {
  /** Ownership once the round has closed. */
  ownership: number
  /** Ownership after converting but before the new money. Meaningful for caps. */
  ownershipAtConversion: number
  /** Principal plus accrued interest — what actually converts. */
  convertingCents: number
  accruedCents: number
  /** What you paid. Never includes interest, so multiples stay honest. */
  investedCents: number
  effectiveValuationCents: number
  route: ConversionRoute
  /** True when the answer depends on instruments the angel cannot see. */
  estimate: boolean
}

const ACCRUING: readonly InstrumentType[] = ['cla', 'kiss_debt']

export function instrumentPath(type: InstrumentType): InstrumentPath {
  if (type === 'equity') return 'priced'
  return accruesInterest(type) ? 'accruing' : 'convertible'
}

export function accruesInterest(type: InstrumentType): boolean {
  return ACCRUING.includes(type)
}

/** Only a loan has a maturity date to reach. */
export function matures(type: InstrumentType): boolean {
  return accruesInterest(type)
}

export function defaultCapBasis(type: InstrumentType): CapBasis {
  return type === 'safe_pre' ? 'pre' : 'post'
}

export function isEstimate(type: InstrumentType): boolean {
  return defaultCapBasis(type) === 'pre'
}

/**
 * Simple interest is charged on the principal alone; compounding charges it on
 * the interest too. Both are in the market, so neither is assumed.
 */
export function accrue(
  principalCents: number,
  rate: number,
  years: number,
  mode: InterestMode = 'simple',
): number {
  if (rate <= 0 || years <= 0) return principalCents
  const factor = mode === 'simple' ? 1 + rate * years : (1 + rate) ** years
  return roundCents(principalCents * factor)
}

const MS_PER_DAY = 86_400_000
const DAYS_PER_YEAR = 365

/**
 * Actual/365, the convention most convertible loan agreements use. A span
 * containing a leap day therefore runs a little over the nominal term, which is
 * the lender's favour and what the paperwork actually says.
 */
export function yearsBetween(startIso: string, endIso: string): number {
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new RangeError(`Cannot read "${startIso}" or "${endIso}" as a date.`)
  }
  if (end < start) {
    throw new RangeError(`Conversion date ${endIso} falls before the investment date ${startIso}.`)
  }
  return (end - start) / MS_PER_DAY / DAYS_PER_YEAR
}

/**
 * A pre-money cap converts against the pre-money capitalisation, so everything
 * converting alongside dilutes everything else. Working it through the share
 * ledger, the holder ends up with `A / (cap + A + others)` before the new money,
 * which is the same as a post-money cap of `cap + A + others`. That lets both
 * kinds of cap run through one formula.
 */
function effectivePostCap(cap: number, basis: CapBasis, converting: number, others: number): number {
  return basis === 'post' ? cap : cap + converting + others
}

export function convert(input: ConvertibleInput, round: RoundTerms): Conversion {
  const value = postMoney(round)
  const priceRatio = value / round.preMoney
  const priced = instrumentPath(input.type) === 'priced'

  const accruedBase = accruesInterest(input.type)
    ? accrue(
        input.amountCents,
        input.interestRate ?? 0,
        input.years ?? 0,
        input.interestMode ?? 'simple',
      )
    : input.amountCents
  const convertingCents = accruedBase

  // Priced equity has no cap and no discount to consider; it buys at the round.
  const routes: Array<{ route: ConversionRoute; valuation: number }> = []
  if (!priced && input.capCents !== undefined && input.capCents > 0) {
    const basis = input.capBasis ?? defaultCapBasis(input.type)
    const cap = effectivePostCap(
      input.capCents,
      basis,
      convertingCents,
      input.otherConvertingCents ?? 0,
    )
    routes.push({ route: 'cap', valuation: roundCents(cap * priceRatio) })
  }
  if (!priced && input.discount !== undefined && input.discount > 0) {
    routes.push({ route: 'discount', valuation: roundCents(value * (1 - input.discount)) })
  }
  routes.push({ route: 'round_price', valuation: value })

  // The lower effective valuation is the better deal, and it wins outright.
  // Ties go to the cap, which is the order routes were pushed in.
  let best = routes[0] as { route: ConversionRoute; valuation: number }
  for (const candidate of routes) {
    if (candidate.valuation < best.valuation) best = candidate
  }

  const ownership = convertingCents / best.valuation
  return {
    ownership,
    ownershipAtConversion: ownership * priceRatio,
    convertingCents,
    accruedCents: convertingCents - input.amountCents,
    investedCents: input.amountCents,
    effectiveValuationCents: best.valuation,
    route: best.route,
    estimate: !priced && (input.capBasis ?? defaultCapBasis(input.type)) === 'pre',
  }
}

export type MaturityChoice = 'convert' | 'repay' | 'extend'

export interface MaturityOutcome {
  kind: MaturityChoice
  /** Principal plus interest accrued to the maturity date. */
  owedCents: number
}

/**
 * What a loan is worth at maturity when no priced round has arrived. Converting
 * carries the accrued amount into a conversion, repaying makes it a cash claim
 * senior to every equity holder, and extending leaves it outstanding.
 */
export function maturityOutcome(
  input: ConvertibleInput,
  choice: MaturityChoice,
): MaturityOutcome {
  if (!matures(input.type)) {
    throw new RangeError(
      `A ${input.type} has no maturity date. Only a convertible loan reaches one.`,
    )
  }
  return {
    kind: choice,
    owedCents: accrue(
      input.amountCents,
      input.interestRate ?? 0,
      input.years ?? 0,
      input.interestMode ?? 'simple',
    ),
  }
}
