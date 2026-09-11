/**
 * Money is held as an integer number of cents, everywhere, for the life of a
 * calculation. Formatting to a currency string happens at the edge, in the UI.
 *
 * The reason is not pedantry. A cap table accumulates dozens of multiplications
 * across several rounds, and floating-point dollars drift enough that ownership
 * stops summing to 100%. Users notice that immediately and stop trusting the
 * tool, which is fatal for something whose only product is a number.
 */

/** Largest value we can hold in cents without losing integer precision. */
export const MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER

/**
 * Commercial rounding: halves go away from zero, so 0.5 becomes 1 and -0.5
 * becomes -1. JavaScript's `Math.round` breaks ties toward positive infinity,
 * which would round -0.5 to -0 and quietly bias every negative result.
 */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot round ${value} to cents.`)
  }
  const rounded = value < 0 ? -Math.round(-value) : Math.round(value)
  if (!Number.isSafeInteger(rounded)) {
    throw new RangeError(
      `${value} is beyond the range this calculator can hold exactly in cents.`,
    )
  }
  return rounded
}

/** Dollars (or euros, or pounds) to cents. */
export function toCents(major: number): number {
  return roundCents(major * 100)
}

/** Cents back to major units. Display only — never feed this into a calculation. */
export function toMajor(cents: number): number {
  return cents / 100
}

export function isSafeCents(value: number): boolean {
  return Number.isSafeInteger(value) && Math.abs(value) <= MAX_SAFE_CENTS
}
