import { BetaBadge, Wordmark } from './Section'
import { ThemeToggle } from './ThemeToggle'
import { track } from '../analytics/track'
import { INVESTMENT_INPUT_ID, scrollToSection } from './scroll'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-ground/90 backdrop-blur">
      <a
        href="#calculator"
        onClick={(e) => {
          e.preventDefault()
          scrollToSection('calculator', document.getElementById(INVESTMENT_INPUT_ID))
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-40 focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-ink"
      >
        Skip to calculator
      </a>
      <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault()
            scrollToSection('hero')
          }}
          className="whitespace-nowrap text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:text-lg"
        >
          <Wordmark />
        </a>
        <BetaBadge />
        <span className="grow" />
        <ThemeToggle />
        <button
          type="button"
          onClick={() => {
            track({ name: 'hero_cta_clicked', placement: 'nav' })
            scrollToSection('calculator', document.getElementById(INVESTMENT_INPUT_ID))
          }}
          // Below 360px there is no room beside the name; the hero's own button is on screen there.
          className="hidden shrink-0 rounded-full border border-accent bg-accent px-4 py-1.5 shadow-sm text-sm font-medium text-on-accent outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 min-[360px]:inline-flex"
        >
          Use calculator
        </button>
      </nav>
    </header>
  )
}
