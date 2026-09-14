import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAnalytics, setAnalyticsSink, track, trackOnce } from './track'
import type { AnalyticsEvent } from './track'

afterEach(() => resetAnalytics())

describe('track', () => {
  it('sends nothing anywhere until a sink is set', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(() => track({ name: 'page_viewed' })).not.toThrow()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('hands every event to the sink', () => {
    const seen: AnalyticsEvent[] = []
    setAnalyticsSink((event) => seen.push(event))
    track({ name: 'funding_round_added', rounds: 2 })
    expect(seen).toEqual([{ name: 'funding_round_added', rounds: 2 }])
  })

  it('sends a once-per-visit event only the first time', () => {
    const seen: AnalyticsEvent[] = []
    setAnalyticsSink((event) => seen.push(event))
    trackOnce({ name: 'calculator_started' })
    trackOnce({ name: 'calculator_started' })
    expect(seen).toHaveLength(1)
  })

  it('never lets a broken sink break the calculator', () => {
    setAnalyticsSink(() => {
      throw new Error('provider down')
    })
    expect(() => track({ name: 'page_viewed' })).not.toThrow()
  })
})
