/**
 * Formatting lives at the edge. The engine deals in integer cents and raw
 * fractions and never sees a formatted string.
 */
import { toCents, toMajor } from '../engine/money'
import type { Round } from '../engine/types'

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

/** Shown under every instrument selector. The instrument does not change the maths. */
export const INSTRUMENT_NOTE =
  'A label only: every instrument is priced at this round’s valuation — caps, discounts and interest are not modelled.'

const SUFFIX: Record<string, number> = { '': 1, k: 1e3, m: 1e6, b: 1e9, bn: 1e9 }

/**
 * Money as people type it: separators, a currency symbol, spaces, and the
 * shorthand angels use out loud — "5k", "4m", "1bn". Returns cents, or
 * undefined when the text is not an amount.
 */
export function parseMoney(text: string): number | undefined {
  const cleaned = text.toLowerCase().replace(/[\s,€$£]/g, '')
  const match = /^(\d+(?:\.\d+)?|\.\d+)(k|m|bn|b)?$/.exec(cleaned)
  if (!match) return undefined
  const multiplier = SUFFIX[match[2] ?? ''] ?? 1
  return toCents(Number(match[1]) * multiplier)
}

/** An amount as it sits in an input: grouped, no symbol, and empty for zero. */
export function moneyInputText(cents: number): string {
  if (cents === 0) return ''
  return toMajor(cents).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/** A multiple on invested capital: "25.6×", "16×", "0.31×". */
export function multiple(x: number): string {
  if (x === 0) return '0×'
  const places = x >= 100 ? 0 : x >= 10 ? 1 : 2
  return `${Number(x.toFixed(places))}×`
}

/** An ownership percentage, with a third decimal once it is below 0.1%. */
export function ownership(fraction: number): string {
  if (fraction === 0) return '0%'
  return percent(fraction, fraction < 0.001 ? 3 : 2)
}

/** A round's name for headings and tables. A custom name can be blank mid-edit. */
export function roundName(round: Round): string {
  return round.label.trim() || 'Untitled round'
}
