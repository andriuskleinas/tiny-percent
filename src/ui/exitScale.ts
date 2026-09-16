import { toCents } from '../engine/money'

/**
 * The exit slider's stops: round numbers from €1M to €10B, spaced so each
 * decade gets the same length of track. Every one-click preset the calculator
 * used to offer is a stop, so dragging lands on the familiar values.
 */
const MANTISSAS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5]

export const EXIT_STOPS_CENTS: readonly number[] = [
  ...[1e6, 1e7, 1e8, 1e9].flatMap((decade) => MANTISSAS.map((m) => toCents(m * decade))),
  toCents(1e10),
]

/** The stop nearest a value, measured on the log scale the track is drawn on. */
export function nearestStop(valueCents: number): number {
  if (!(valueCents > 0)) return 0
  let best = 0
  let distance = Infinity
  EXIT_STOPS_CENTS.forEach((stop, i) => {
    const d = Math.abs(Math.log(stop) - Math.log(valueCents))
    if (d < distance) {
      distance = d
      best = i
    }
  })
  return best
}

const MIN_EXIT = toCents(1e6)
const MAX_EXIT = toCents(1e10)

/** How many positions the exit slider has. Fine enough that every preset lands exactly. */
export const SLIDER_POSITIONS = 10_000

/**
 * The increment the exit moves in around a value: half a million where a
 * difference that size matters, coarser where it would be noise.
 */
export function exitIncrement(valueCents: number): number {
  if (valueCents < toCents(1e8)) return toCents(500_000)
  if (valueCents < toCents(1e9)) return toCents(5_000_000)
  return toCents(50_000_000)
}

/** A value rounded to the slider's increment, and kept on the track. */
export function roundExit(valueCents: number): number {
  const step = exitIncrement(valueCents)
  return Math.min(MAX_EXIT, Math.max(MIN_EXIT, Math.round(valueCents / step) * step))
}

/** Where a value sits on the slider's log-scaled track. */
export function positionOf(valueCents: number): number {
  const clamped = Math.min(MAX_EXIT, Math.max(MIN_EXIT, valueCents))
  return Math.round((Math.log(clamped / MIN_EXIT) / Math.log(MAX_EXIT / MIN_EXIT)) * SLIDER_POSITIONS)
}

/** The exit at a slider position, rounded to its increment. */
export function valueAt(position: number): number {
  const fraction = Math.min(1, Math.max(0, position / SLIDER_POSITIONS))
  return roundExit(MIN_EXIT * (MAX_EXIT / MIN_EXIT) ** fraction)
}

/** One arrow-key press: up or down by the increment where the value is. */
export function stepExit(valueCents: number, direction: 1 | -1): number {
  const current = roundExit(valueCents)
  const down = direction < 0 ? exitIncrement(current - 1) : exitIncrement(current)
  return roundExit(current + direction * down)
}
