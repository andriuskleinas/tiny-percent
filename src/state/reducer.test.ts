import { describe, expect, it } from 'vitest'
import { toCents } from '../engine/money'
import { stepFromRound } from '../engine/step'
import { EXAMPLE, STARTING_POINT } from './presets'
import { reducer } from './reducer'

describe('editing a round by growth and share sold', () => {
  it('writes the post-money and the raise, measured from the round before', () => {
    const next = reducer(EXAMPLE, { type: 'round:step', id: 'series-b', growth: 1.25, sold: 0.25 })
    const b = next.rounds.find((r) => r.id === 'series-b')
    expect(b).toMatchObject({ valuationCents: toCents(18_750_000), raisedCents: toCents(4_687_500), valuationBasis: 'post' })
    expect(stepFromRound(toCents(15_000_000), b!)?.stakeFactor).toBeCloseTo(0.9375, 12)
  })

  it('keeps the total raised in step with the rounds', () => {
    const next = reducer(EXAMPLE, { type: 'round:step', id: 'series-b', growth: 1.25, sold: 0.25 })
    expect(next.exit.totalRaisedCents).toBe(toCents(32_000_000 - 8_000_000 + 4_687_500))
  })

  it('leaves the other rounds and your cheques alone', () => {
    const next = reducer(EXAMPLE, { type: 'round:step', id: 'series-b', growth: 2, sold: 0.1 })
    expect(next.rounds.filter((r) => r.id !== 'series-b')).toEqual(EXAMPLE.rounds.filter((r) => r.id !== 'series-b'))
  })

  it('does nothing to the entry, which has no round before it', () => {
    expect(reducer(STARTING_POINT, { type: 'round:step', id: 'seed', growth: 2, sold: 0.1 })).toBe(STARTING_POINT)
  })

  it('does nothing when the values have no answer', () => {
    expect(reducer(EXAMPLE, { type: 'round:step', id: 'series-b', growth: 0, sold: 0.1 })).toBe(EXAMPLE)
    expect(reducer(EXAMPLE, { type: 'round:step', id: 'series-b', growth: 2, sold: 1 })).toBe(EXAMPLE)
  })
})
