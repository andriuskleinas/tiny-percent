// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { easeOutCubic, usePrefersReducedMotion, useTween } from './motion'

function prefersReduced(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

describe('easing', () => {
  it('starts at 0, ends at 1 and front-loads the movement', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })
})

describe('useTween', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    prefersReduced(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    // jsdom has no matchMedia; put it back the way it was.
    Reflect.deleteProperty(window, "matchMedia")
  })

  it('shows the first value straight away, so hydration matches', () => {
    const { result } = renderHook(() => useTween(10))
    expect(result.current).toBe(10)
  })

  it('eases toward a new value and lands on it exactly', () => {
    const { result, rerender } = renderHook(({ v }) => useTween(v, 400), { initialProps: { v: 0 } })
    rerender({ v: 100 })
    act(() => void vi.advanceTimersByTime(200))
    expect(result.current).toBeGreaterThan(0)
    expect(result.current).toBeLessThan(100)
    act(() => void vi.advanceTimersByTime(400))
    expect(result.current).toBe(100)
  })

  it('jumps straight to the value when the reader asks for reduced motion', () => {
    prefersReduced(true)
    const { result, rerender } = renderHook(({ v }) => useTween(v), { initialProps: { v: 0 } })
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true)
    rerender({ v: 100 })
    expect(result.current).toBe(100)
  })
})
