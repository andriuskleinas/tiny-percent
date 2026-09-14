/**
 * Internal rate of return from dated cash flows. Negative amounts are money
 * leaving you, positive amounts money coming back.
 *
 * Solved by bisection, which always converges on a bracketed root, then a few
 * Newton steps to polish. Newton alone is not safe here: net present value is
 * badly behaved near minus one hundred percent, which is exactly where a failed
 * angel investment sits.
 */

export interface CashFlow {
  /** ISO 8601 date. */
  date: string
  amountCents: number
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

const LOWER = -0.999999
const UPPER = 1_000
const BISECTIONS = 200
const NEWTON_STEPS = 8

export function irr(flows: CashFlow[]): number | undefined {
  if (flows.length < 2) return undefined
  if (!flows.some((f) => f.amountCents > 0)) return undefined
  if (!flows.some((f) => f.amountCents < 0)) return undefined

  const sorted = [...flows].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const start = sorted[0]?.date as string
  const dated = sorted.map((f) => ({
    years: yearsBetween(start, f.date),
    amount: f.amountCents,
  }))

  const npv = (rate: number): number =>
    dated.reduce((sum, f) => sum + f.amount / (1 + rate) ** f.years, 0)
  const slope = (rate: number): number =>
    dated.reduce((sum, f) => sum - (f.years * f.amount) / (1 + rate) ** (f.years + 1), 0)

  let low = LOWER
  let high = UPPER
  const atLow = npv(low)
  if (atLow * npv(high) > 0) return undefined

  for (let i = 0; i < BISECTIONS; i += 1) {
    const mid = (low + high) / 2
    if (atLow * npv(mid) <= 0) high = mid
    else low = mid
  }

  let rate = (low + high) / 2
  for (let i = 0; i < NEWTON_STEPS; i += 1) {
    const derivative = slope(rate)
    if (derivative === 0 || !Number.isFinite(derivative)) break
    const next = rate - npv(rate) / derivative
    // Newton may wander outside the bracket; the bisected answer is already good.
    if (!Number.isFinite(next) || next <= LOWER || next >= UPPER) break
    rate = next
  }
  return rate
}
