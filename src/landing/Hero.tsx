import { useEffect, useRef, useState } from 'react'
import { track } from '../analytics/track'
import { CoffeeButton } from '../ui/Coffee'
import { CurrencyContext, useMoney } from '../ui/currency'
import { ownership } from '../ui/format'
import { usePrefersReducedMotion, useTween } from '../ui/motion'
import { SITE } from '../site'
import { HERO_FACTS } from './example'
import { INVESTMENT_INPUT_ID, scrollToSection } from './scroll'

/** The hero's promises: a title, the plain fact behind it, and a 16px line icon. */
const PROMISES = [
  {
    text: 'Runs in your browser',
    detail: 'Your numbers never leave it',
    icon: (
      <>
        <rect x="3" y="7" width="10" height="7" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
      </>
    ),
  },
  {
    text: 'No data, no tracking',
    detail: 'No account, no cookies',
    icon: (
      <>
        <path d="M2 8s2.2-4.5 6-4.5S14 8 14 8s-2.2 4.5-6 4.5S2 8 2 8Z" />
        <circle cx="8" cy="8" r="1.75" />
        <path d="m2.5 2.5 11 11" />
      </>
    ),
  },
  {
    text: 'Free and educational',
    detail: 'No ads, no paywall',
    icon: (
      <>
        <path d="M1.5 6 8 3l6.5 3L8 9 1.5 6Z" />
        <path d="M4.5 7.5V11c1 .9 2.2 1.4 3.5 1.4s2.5-.5 3.5-1.4V7.5" />
      </>
    ),
  },
]

export function Hero() {
  return (
    <section id="hero" aria-labelledby="hero-title" className="scroll-mt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_26rem] lg:pb-24">
        <div>
          <h1 id="hero-title" className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-ink outline-none sm:text-6xl">
            See what your startup investment could become
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft sm:text-xl">
            Every time a startup raises money, your share of it shrinks. See what following on would cost, and what
            your stake could return when the company sells.
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={() => {
                track({ name: 'hero_cta_clicked', placement: 'hero' })
                scrollToSection('calculator', document.getElementById(INVESTMENT_INPUT_ID))
              }}
              className="rounded-full border border-accent bg-accent px-6 py-3 shadow-card font-medium text-on-accent outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
            >
              Use calculator
            </button>
          </div>
          {/* Keep this true. If analytics are ever connected (analytics/track.ts), this line
              and the Privacy page both have to change first. */}
          <ul
            aria-label="What tinypercent does with your data"
            className="mt-10 grid max-w-2xl divide-y divide-rule rounded-2xl border border-rule bg-surface shadow-card sm:grid-cols-3 sm:divide-x sm:divide-y-0"
          >
            {PROMISES.map(({ text, detail, icon }) => (
              <li key={text} className="flex items-center gap-3 px-4 py-3.5 sm:flex-col sm:items-start sm:gap-2.5 sm:p-4">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-on-accent shadow-sm">
                  <svg viewBox="0 0 16 16" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {icon}
                  </svg>
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-ink">{text}</span>
                  <span className="text-xs text-ink-faint">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-5">
          <CurrencyContext.Provider value={HERO_FACTS.currency}>
            <HeroPreview />
          </CurrencyContext.Provider>
          {SITE.supportUrl ? (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-ink-faint">
              <CoffeeButton placement="hero" size="sm" />
              <span>Free to use. Support it if it helps you.</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

const STEP_MS = 1700
const HOLD_MS = 3800

/**
 * The product as the hero image: €5,000 into a Pre-seed round, then the stake
 * shrinking round by round while what it is worth grows, and finally the exit.
 *
 * The prerendered page, the first render, readers who ask for reduced motion
 * and browsers without IntersectionObserver all see the finished story, which
 * is also what a screen reader is given. The animation plays only while the
 * card is on screen, and can be paused.
 */
function HeroPreview() {
  const { money, compactMoney } = useMoney()
  const { steps, chequeCents, exitCents } = HERO_FACTS
  const last = steps.length - 1
  const rounds = steps.filter((s) => !s.exit)
  const first = steps[0]
  const final = steps[last]
  const [step, setStep] = useState(last)
  const [visible, setVisible] = useState(false)
  const [paused, setPaused] = useState(false)
  const started = useRef(false)
  const figure = useRef<HTMLElement>(null)
  const reduced = usePrefersReducedMotion()
  const animated = visible && !reduced

  useEffect(() => {
    const el = figure.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false), { threshold: 0.35 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!animated || paused) return undefined
    if (!started.current) {
      started.current = true
      const t = setTimeout(() => setStep(0), 400)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStep((s) => (s >= last ? 0 : s + 1)), step >= last ? HOLD_MS : STEP_MS)
    return () => clearTimeout(t)
  }, [animated, paused, step, last])

  const current = steps[step] ?? final
  const own = useTween(current?.ownership ?? 0, 800)
  const value = useTween(current?.valueCents ?? 0, 800)
  const widest = Math.max(...rounds.map((r) => r.ownership))
  if (!current || !first || !final) return null

  const note = current.exit
    ? `the company sells for ${compactMoney(exitCents)}`
    : current.change === undefined
      ? `bought at ${compactMoney(current.valuationCents)} post-money`
      : `${current.change < 0 ? '−' : '+'}${Math.abs(Math.round(current.change * 100))}% of your share in ${current.label}`

  return (
    <figure
      ref={figure}
      aria-label={`Example: ${money(chequeCents)} invested at ${first.label}. Without following on, ${ownership(first.ownership)} becomes ${ownership(final.ownership)} after ${rounds
        .slice(1)
        .map((r) => r.label)
        .join(', ')}, worth ${money(final.valueCents)} at a ${compactMoney(exitCents)} exit.`}
      className="rounded-3xl border border-rule bg-surface p-6 shadow-[0_1px_0_var(--color-rule),0_24px_48px_-24px_rgb(21_25_34/0.18)]"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-2xl font-semibold tracking-tight text-ink">
          {money(chequeCents)} invested at {first.label}
        </p>
        {animated ? (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play the example' : 'Pause the example'}
            className="mt-1 shrink-0 rounded-full border border-rule px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft outline-none hover:border-rule-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {paused ? 'Play' : 'Pause'}
          </button>
        ) : null}
      </div>

      <ol aria-hidden="true" className="mt-4 flex flex-wrap gap-1.5 font-mono text-[10px] uppercase tracking-wider">
        {steps.map((s, i) => (
          <li
            key={s.label}
            data-current={i === step || undefined}
            className={`rounded-full border px-2 py-0.5 transition-colors duration-300 ${
              i === step ? 'border-accent bg-accent text-on-accent' : i < step ? 'border-rule-strong text-ink-soft' : 'border-rule text-ink-faint'
            }`}
          >
            {s.label}
          </li>
        ))}
      </ol>

      <div aria-hidden="true" className="mt-5 grid grid-cols-2 gap-4 border-y border-rule py-4">
        <div>
          <p className="text-xs text-ink-faint">Your ownership</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-ink">{ownership(own)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">{current.exit ? `Value at a ${compactMoney(exitCents)} exit` : 'Paper value'}</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-gain">{money(value)}</p>
        </div>
        <p className={`col-span-2 -mt-2 font-mono text-[11px] tabular-nums ${current.change !== undefined && current.change < 0 ? 'text-dilute' : 'text-ink-faint'}`}>
          {note}
        </p>
      </div>

      <ol aria-hidden="true" className="mt-4 flex flex-col gap-2">
        {rounds.map((r, i) => {
          const reached = i <= step
          return (
            <li key={r.label} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 font-mono text-[11px] tabular-nums">
              <span className={reached ? 'text-ink-soft' : 'text-ink-faint'}>{r.label}</span>
              <span className="h-2 bg-sunk">
                <span
                  className="block h-full bg-accent transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: reached ? `${(r.ownership / widest) * 100}%` : '0%' }}
                />
              </span>
              <span className={`text-right ${reached ? 'text-ink-soft' : 'text-ink-faint/40'}`}>{ownership(r.ownership)}</span>
            </li>
          )
        })}
      </ol>

      <dl className="sr-only">
        <dt>Initial ownership</dt>
        <dd>{ownership(first.ownership)}</dd>
        <dt>Ownership after future rounds</dt>
        <dd>{ownership(final.ownership)}</dd>
        <dt>Potential value at a {compactMoney(exitCents)} exit</dt>
        <dd>{money(final.valueCents)}</dd>
      </dl>

      <figcaption className="mt-4 text-xs text-ink-faint">
        Example: a {first.label} cheque at a {compactMoney(first.valuationCents)} post-money valuation. You don’t follow on
        in {rounds.slice(1).map((r) => r.label).join(', ').replace(/, ([^,]*)$/, ' or $1')}. Hypothetical, not a forecast.
      </figcaption>
    </figure>
  )
}
