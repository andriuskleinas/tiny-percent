import type { ReactNode } from 'react'

/** A landing section: an id to scroll to, and a heading that names the region. */
export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  tone = 'plain',
}: {
  id: string
  eyebrow?: string | undefined
  title: string
  lede?: ReactNode | undefined
  children: ReactNode
  tone?: 'plain' | 'band'
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-20 border-t border-rule ${tone === 'band' ? 'bg-surface' : ''}`}
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        {eyebrow ? <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">{eyebrow}</p> : null}
        <h2 id={`${id}-title`} className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-ink outline-none sm:text-4xl">
          {title}
        </h2>
        {lede ? <div className="mt-4 max-w-2xl text-lg text-ink-soft">{lede}</div> : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}

/** The brand mark: three stakes, each narrower and taller — the calculator's own picture. */
export function Mark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <rect x="1" y="13" width="7" height="6" className="fill-accent" opacity="0.45" />
      <rect x="9.5" y="8" width="5" height="11" className="fill-accent" opacity="0.7" />
      <rect x="16" y="2" width="3" height="17" className="fill-accent" />
    </svg>
  )
}
