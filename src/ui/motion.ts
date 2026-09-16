import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Motion for the visuals, without an animation library. Geometry eases toward
 * new numbers so a stake visibly shrinks or grows; text never tweens, so what a
 * reader or a test sees is always the engine's exact figure.
 *
 * Both hooks give the final value on the server, on the first client render
 * (so hydration matches the prerendered HTML) and whenever the reader has asked
 * for reduced motion.
 */

const QUERY = '(prefers-reduced-motion: reduce)'

function media(): MediaQueryList | undefined {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : undefined
}

function subscribe(onChange: () => void): () => void {
  const list = media()
  list?.addEventListener('change', onChange)
  return () => list?.removeEventListener('change', onChange)
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false)
}

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

/** `target`, eased toward over `ms` whenever it changes. */
export function useTween(target: number, ms = 450): number {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(target)
  const shown = useRef(target)

  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== 'function') {
      shown.current = target
      return undefined
    }
    const from = shown.current
    if (from === target) return undefined
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, Math.max(0, (now - start) / ms))
      shown.current = progress === 1 ? target : from + (target - from) * easeOutCubic(progress)
      setValue(shown.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, ms, reduced])

  return reduced ? target : value
}
