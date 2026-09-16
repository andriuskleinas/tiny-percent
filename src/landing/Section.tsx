import type { ReactNode } from 'react'

/** A landing section: an id to scroll to, and a heading that names the region. */
export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  tone = 'plain',
  align = 'start',
}: {
  id: string
  eyebrow?: string | undefined
  title: string
  lede?: ReactNode | undefined
  children: ReactNode
  tone?: 'plain' | 'band'
  align?: 'start' | 'center'
}) {
  const centred = align === 'center'
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-20 border-t border-rule ${tone === 'band' ? 'bg-surface' : ''}`}
    >
      <div className={`mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 ${centred ? 'text-center' : ''}`}>
        {eyebrow ? <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">{eyebrow}</p> : null}
        <h2 id={`${id}-title`} className={`mt-2 max-w-3xl text-3xl ${centred ? 'mx-auto' : ''} font-semibold tracking-tight text-ink outline-none sm:text-4xl`}>
          {title}
        </h2>
        {lede ? <div className={`mt-4 max-w-2xl text-lg text-ink-soft ${centred ? 'mx-auto' : ''}`}>{lede}</div> : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}

const CELLS = Array.from({ length: 25 }, (_, i) => i)

/**
 * The brand mark: the company as a grid, and one cell of it yours — the tiny
 * percent. The blue cell hops around the grid; `favicon.svg` and the preview
 * image draw it still, in the corner, which is also where it rests for anyone
 * who asks for reduced motion.
 */
export function Mark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      {CELLS.map((i) => (
        <rect
          key={i}
          x={0.5 + (i % 5) * 4}
          y={0.5 + Math.floor(i / 5) * 4}
          width="3"
          height="3"
          className="fill-ink-faint"
          opacity={0.35}
        />
      ))}
      <rect x="16.5" y="16.5" width="3" height="3" className="tp-mark-dot fill-slice" />
    </svg>
  )
}

/** The name as it is drawn: lowercase, with "percent" in the slice colour. */
/** Says the site is still being shaped, beside the name in the header. */
export function BetaBadge() {
  return (
    <span className="rounded-full border border-accent/30 bg-accent-wash px-2 py-0.5 text-[11px] font-semibold uppercase leading-none tracking-wider text-accent">
      Beta
    </span>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-[-0.03em] ${className}`}>
      <Mark />
      <span>
        tiny<span className="text-accent">percent</span>
      </span>
    </span>
  )
}
