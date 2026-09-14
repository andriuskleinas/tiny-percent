import { Mark } from './Section'
import { INVESTMENT_INPUT_ID, scrollToSection } from './scroll'

const LINKS = [
  ['calculator', 'Calculator'],
  ['how-it-works', 'How it works'],
  ['faq', 'FAQ'],
] as const

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
      <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault()
            scrollToSection('hero')
          }}
          className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold tracking-tight text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:text-base"
        >
          <Mark />
          Angel Investment Calculator
        </a>
        <span className="grow" />
        <ul className="hidden items-center gap-6 text-sm text-ink-soft md:flex">
          {LINKS.map(([id, text]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  scrollToSection(id)
                }}
                className="outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {text}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => scrollToSection('calculator', document.getElementById(INVESTMENT_INPUT_ID))}
          // Below 360px there is no room beside the name; the hero's own button is on screen there.
          className="hidden shrink-0 border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-on-accent outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 min-[360px]:inline-flex"
        >
          Use calculator
        </button>
      </nav>
    </header>
  )
}
