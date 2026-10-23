import { track } from '../analytics/track'
import type { SupportPlacement } from '../analytics/track'
import { SITE } from '../site'

/**
 * "Buy me a coffee", in two weights: a yellow pill where the page asks
 * outright, and a quiet line under the results where it only reminds. Both
 * open Buy Me a Coffee in a new tab and render nothing while no support link
 * is configured.
 */

export function CupIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 5.5h8v4a3.5 3.5 0 0 1-3.5 3.5h-1a3.5 3.5 0 0 1-3.5-3.5v-4Z" />
      <path d="M11.5 6.5h.75a1.75 1.75 0 0 1 0 3.5h-.9" />
      <path d="M6 1.5c-.5.6.5 1.2 0 1.8M8.5 1.5c-.5.6.5 1.2 0 1.8" />
    </svg>
  )
}

const external = { target: '_blank', rel: 'noopener noreferrer' } as const

export function CoffeeButton({ placement, size = 'md' }: { placement: SupportPlacement; size?: 'sm' | 'md' }) {
  if (!SITE.supportUrl) return null
  const pad = size === 'sm' ? 'px-3.5 py-1.5 text-sm' : 'px-5 py-2.5 text-sm sm:text-base'
  return (
    <a
      href={SITE.supportUrl}
      {...external}
      onClick={() => track({ name: 'support_clicked', placement })}
      className={`inline-flex items-center gap-2 rounded-full bg-coffee font-semibold text-on-coffee shadow-sm outline-none transition-transform duration-150 hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${pad}`}
    >
      <CupIcon className={size === 'sm' ? 'size-4' : 'size-[18px]'} />
      Buy me a coffee
      <span className="sr-only"> (opens Buy Me a Coffee in a new tab)</span>
    </a>
  )
}

/** One quiet line, for under the results: a reminder, not an ask. */
export function CoffeeNudge() {
  if (!SITE.supportUrl) return null
  return (
    <p className="flex items-center justify-center gap-1.5 text-sm text-ink-faint">
      Found this useful?
      <a
        href={SITE.supportUrl}
        {...external}
        onClick={() => track({ name: 'support_clicked', placement: 'calculator' })}
        className="group inline-flex items-center gap-1 rounded font-medium text-ink-soft outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <CupIcon className="size-4 transition-colors group-hover:text-coffee-ink" />
        <span className="underline decoration-coffee decoration-2 underline-offset-4">Buy me a coffee</span>
        <span className="sr-only"> (opens Buy Me a Coffee in a new tab)</span>
      </a>
    </p>
  )
}
