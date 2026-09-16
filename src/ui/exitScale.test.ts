import { describe, expect, it } from 'vitest'
import { toCents } from '../engine/money'
import { EXIT_PRESETS_CENTS } from '../state/presets'
import { EXIT_STOPS_CENTS, SLIDER_POSITIONS, nearestStop, positionOf, roundExit, stepExit, valueAt } from './exitScale'

describe('the exit slider’s stops', () => {
  it('run from €1M to €10B in increasing order', () => {
    expect(EXIT_STOPS_CENTS[0]).toBe(toCents(1_000_000))
    expect(EXIT_STOPS_CENTS.at(-1)).toBe(toCents(10_000_000_000))
    EXIT_STOPS_CENTS.slice(1).forEach((stop, i) => expect(stop).toBeGreaterThan(EXIT_STOPS_CENTS[i] as number))
  })

  it('include every familiar preset', () => {
    for (const preset of EXIT_PRESETS_CENTS) expect(EXIT_STOPS_CENTS).toContain(preset)
  })

  it('find a stop exactly, or the nearest one for any other value', () => {
    expect(EXIT_STOPS_CENTS[nearestStop(toCents(250_000_000))]).toBe(toCents(250_000_000))
    expect(EXIT_STOPS_CENTS[nearestStop(toCents(260_000_000))]).toBe(toCents(250_000_000))
    expect(nearestStop(0)).toBe(0)
    expect(nearestStop(toCents(1e12))).toBe(EXIT_STOPS_CENTS.length - 1)
  })
})

describe('the exit slider moves in half-million steps', () => {
  it('rounds to €0.5M below €100M, and more coarsely above', () => {
    expect(roundExit(toCents(7_320_000))).toBe(toCents(7_500_000))
    expect(roundExit(toCents(7_240_000))).toBe(toCents(7_000_000))
    expect(roundExit(toCents(263_000_000))).toBe(toCents(265_000_000))
    expect(roundExit(toCents(1_020_000_000))).toBe(toCents(1_000_000_000))
    expect(roundExit(0)).toBe(toCents(1_000_000))
  })

  it('lands exactly on every familiar preset when the thumb is put there', () => {
    for (const preset of EXIT_PRESETS_CENTS) expect(valueAt(positionOf(preset))).toBe(preset)
    expect(valueAt(0)).toBe(toCents(1_000_000))
    expect(valueAt(SLIDER_POSITIONS)).toBe(toCents(10_000_000_000))
  })

  it('offers every half million between €1M and €100M somewhere on the track', () => {
    for (let major = 1_000_000; major < 100_000_000; major += 500_000) {
      expect(valueAt(positionOf(toCents(major)))).toBe(toCents(major))
    }
  })

  it('steps by €0.5M with the arrow keys, and by the coarser increment higher up', () => {
    expect(stepExit(toCents(7_500_000), 1)).toBe(toCents(8_000_000))
    expect(stepExit(toCents(7_500_000), -1)).toBe(toCents(7_000_000))
    expect(stepExit(toCents(100_000_000), -1)).toBe(toCents(99_500_000))
    expect(stepExit(toCents(99_500_000), 1)).toBe(toCents(100_000_000))
    expect(stepExit(toCents(100_000_000), 1)).toBe(toCents(105_000_000))
    expect(stepExit(toCents(1_000_000), -1)).toBe(toCents(1_000_000))
  })
})
