/**
 * Formatting lives at the edge. The engine deals in integer cents and raw
 * fractions and never sees a formatted string.
 */
import { toMajor } from '../engine/money'

export function money(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(toMajor(cents))
}

export function percent(fraction: number, places = 2): string {
  return `${(fraction * 100).toFixed(places)}%`
}

/**
 * Abbreviated money for chart labels, where a full figure would crowd its
 * neighbours. Prose and tables keep the exact number.
 */
export function compactMoney(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(toMajor(cents))
}

/** The bare symbol, for an input prefix. */
export function symbolFor(currency: string): string {
  return (
    new Intl.NumberFormat('en-US', { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  )
}
