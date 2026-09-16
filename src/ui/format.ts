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

/** A typed percentage, "20", "20.5", "20%" or "20,5", as a fraction; undefined when it is not one. */
export function parsePercent(text: string): number | undefined {
  const cleaned = text.replace(/[\s%]/g, '').replace(',', '.')
  if (cleaned === '') return 0
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return undefined
  return Number(cleaned) / 100
}

/**
 * A number being typed, regrouped with thousands separators as it grows, so
 * 48000000 reads as 48,000,000 before you leave the field. Shorthand such as
 * "4m" and anything that is not a plain number are left exactly as typed.
 */
export function groupDigits(text: string): string {
  const match = /^\s*([\d,\s]*)(\.\d*)?\s*$/.exec(text)
  const digits = match?.[1]?.replace(/[,\s]/g, '') ?? ''
  if (!match || digits === '') return text
  const whole = digits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${whole}${match[2] ?? ''}`
}

/**
 * Where the caret belongs after regrouping: just after the same number of
 * digits (and decimal point) it was after before, so typing in the middle of a
 * number does not throw the cursor to the end.
 */
export function caretAfter(formatted: string, significantBefore: number): number {
  if (significantBefore <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/[\d.]/.test(formatted[i] ?? '')) seen++
    if (seen === significantBefore) return i + 1
  }
  return formatted.length
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
