import { CurrencyContext, useMoney } from '../ui/currency'
import { ownership } from '../ui/format'
import { EXAMPLE_FACTS, HERO_EXIT_CENTS } from './example'
import { track } from '../analytics/track'
import { INVESTMENT_INPUT_ID, scrollToSection } from './scroll'

export function Hero({ onExample }: { onExample: () => void }) {
  return (
    <section id="hero" aria-labelledby="hero-title" className="scroll-mt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_24rem] lg:pb-24">
        <div>
          <h1 id="hero-title" className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-ink outline-none sm:text-6xl">
            See what your angel investment could become.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">
            Calculate your startup equity, model dilution across future funding rounds, compare follow-on
            strategies and explore potential exit outcomes.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                track({ name: 'hero_cta_clicked', placement: 'hero' })
                scrollToSection('calculator', document.getElementById(INVESTMENT_INPUT_ID))
              }}
              className="border border-accent bg-accent px-5 py-3 font-medium text-on-accent outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
            >
              Calculate my investment
            </button>
            <button
              type="button"
              onClick={onExample}
              className="border border-rule-strong bg-surface px-5 py-3 font-medium text-ink outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
            >
              See an example
            </button>
          </div>
          <p className="mt-4 text-sm font-medium text-ink-soft">Free. No account required.</p>
        </div>

        <CurrencyContext.Provider value={EXAMPLE_FACTS.currency}>
          <HeroPreview />
        </CurrencyContext.Provider>
      </div>
    </section>
  )
}

/** The product as the hero image: the example's real numbers, and the stake shrinking round by round. */
function HeroPreview() {
  const { money, compactMoney } = useMoney()
  const widest = Math.max(...EXAMPLE_FACTS.path.map((p) => p.ownership))
  const rows: Array<[string, string, string]> = [
    ['Initial ownership', ownership(EXAMPLE_FACTS.initialOwnership), 'text-ink'],
    ['Ownership after future rounds', ownership(EXAMPLE_FACTS.finalOwnership), 'text-ink'],
    [`Potential value at a ${compactMoney(HERO_EXIT_CENTS)} exit`, money(EXAMPLE_FACTS.heroExitProceedsCents), 'text-gain'],
  ]
  return (
    <figure className="border border-rule bg-surface p-6 shadow-[0_1px_0_var(--color-rule),0_24px_48px_-24px_rgb(21_25_34/0.18)]">
      <p className="text-2xl font-semibold tracking-tight text-ink">{money(EXAMPLE_FACTS.chequeCents)} invested</p>
      <dl className="mt-5 flex flex-col divide-y divide-rule border-y border-rule">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className={`font-mono text-lg font-semibold tabular-nums ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <ol className="mt-5 flex flex-col gap-2" aria-label="Your ownership, round by round">
        {EXAMPLE_FACTS.path.map((step) => (
          <li key={step.label} className="grid grid-cols-[5rem_minmax(0,1fr)_3.5rem] items-center gap-3 font-mono text-[11px] tabular-nums">
            <span className="text-ink-faint">{step.label}</span>
            <span className="h-2 bg-sunk" aria-hidden="true">
              <span className="block h-full bg-accent" style={{ width: `${(step.ownership / widest) * 100}%` }} />
            </span>
            <span className="text-right text-ink-soft">{ownership(step.ownership)}</span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-4 text-xs text-ink-faint">
        Example: a Seed cheque at a {compactMoney(EXAMPLE_FACTS.postMoneyCents)} post-money valuation, then Series A, B
        and C. Hypothetical, not a forecast.
      </figcaption>
    </figure>
  )
}
