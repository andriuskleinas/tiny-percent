import { useEffect, useRef, useState } from 'react'

/**
 * The rendered width of an element, so an SVG can be drawn at its real size
 * and keep readable text on a phone instead of scaling a desktop drawing down.
 * Starts at `fallback` on the server and the first client render, so hydration
 * matches, then follows the element.
 */
export function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0)
      if (next > 0) setWidth(next)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}
