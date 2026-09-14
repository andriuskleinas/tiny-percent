import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { CurrencyContext, useMoney } from '../ui/currency'
import { multiple, ownership } from '../ui/format'
import { EXAMPLE_FACTS } from './example'
import { FAQ } from './faq'
import { Section } from './Section'
import { INVESTMENT_INPUT_ID, scrollToSection } from './scroll'

const toCalculator = () => scrollToSection('calculator', document.getElementById(INVESTMENT_INPUT_ID))

const primary =
  'inline-flex items-center border border-accent bg-accent px-4 py-2.5 text-sm font-medium text-on-accent outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2'

export function Features() {
  const cards = [
    ['Know what you own', 'See how much startup equity your investment buys based on the valuation and financing round.'],
    [
      'Understand dilution',
      'Model future fundraising rounds and see how your ownership changes over time. Compare participating, not participating and maintaining pro-rata ownership.',
    ],
    ['Explore exit outcomes', 'See how different hypothetical company exit valuations could affect the value of your investment.'],
  ] as const
  return (
    <Section id="features" eyebrow="What it does" title="Your investment, from cheque to exit." tone="band">
      <ul className="grid gap-4 md:grid-cols-3">
        {cards.map(([title, body], i) => (
          <li key={title} className="border border-rule bg-ground/50 p-6">
            <p className="font-mono text-[11px] tabular-nums text-accent">0{i + 1}</p>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-ink">{title}</h3>
            <p className="mt-2 text-ink-soft">{body}</p>
          </li>
        ))}
      </ul>
      <button type="button" onClick={toCalculator} className={`${primary} mt-8`}>
        Try the calculator
      </button>
    </Section>
  )
}

export function HowItWorks() {
  const steps = [
    ['Enter your investment', 'Add your cheque size, company valuation and financing terms.'],
    ['Add future rounds', 'Model Seed, Series A, Series B and other fundraising rounds.'],
    ['Explore outcomes', 'Compare dilution, follow-on requirements and hypothetical exit scenarios.'],
  ] as const
  return (
    <Section id="how-it-works" eyebrow="How it works" title="Three steps, about thirty seconds.">
      <ol className="grid gap-8 md:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li key={title} className="border-t-2 border-accent pt-5">
            <p className="font-mono text-sm tabular-nums text-ink-faint">0{i + 1}</p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-ink">{title}</h3>
            <p className="mt-2 text-ink-soft">{body}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

export function WorkedExample({ onOpen }: { onOpen: () => void }) {
  return (
    <CurrencyContext.Provider value={EXAMPLE_FACTS.currency}>
      <WorkedExampleBody onOpen={onOpen} />
    </CurrencyContext.Provider>
  )
}

function WorkedExampleBody({ onOpen }: { onOpen: () => void }) {
  const { money, compactMoney } = useMoney()
  const f = EXAMPLE_FACTS
  const terms: Array<[string, string]> = [
    ['Initial investment', money(f.chequeCents)],
    ['Pre-money valuation', compactMoney(f.preMoneyCents)],
    ['Amount raised', compactMoney(f.raisedCents)],
  ]
  const results: Array<[string, string, string]> = [
    ['Initial ownership', ownership(f.initialOwnership), 'text-ink'],
    ['Ownership after dilution', ownership(f.finalOwnership), 'text-ink'],
    [`Potential value at a ${compactMoney(f.exitCents)} exit`, money(f.exitProceedsCents), 'text-gain'],
  ]

  return (
    <Section
      id="example"
      eyebrow="Worked example"
      title={`What happens to a ${money(f.chequeCents)} angel investment?`}
      tone="band"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-3 gap-4">
            {terms.map(([label, value]) => (
              <div key={label} className="border-t border-rule pt-3">
                <dt className="text-xs text-ink-faint">{label}</dt>
                <dd className="mt-1 font-mono text-lg tabular-nums text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">Future rounds</h3>
            <ol className="mt-3 flex flex-col divide-y divide-rule border-y border-rule">
              {f.rounds.map((r) => (
                <li key={r.label} className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-baseline gap-3 py-2.5 text-sm">
                  <span className="font-medium text-ink">{r.label}</span>
                  <span className="text-ink-soft">
                    {compactMoney(r.postMoneyCents)} valuation, raising {compactMoney(r.raisedCents)}
                  </span>
                  <span className="font-mono tabular-nums text-ink">{ownership(r.ownership)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-ink-faint">Valuations are post-money. You sit out every later round.</p>
          </div>
        </div>

        <div className="border border-rule bg-ground/50 p-6">
          <dl className="flex flex-col gap-4">
            {results.map(([label, value, tone]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 border-b border-rule pb-4 last:border-0 last:pb-0">
                <dt className="text-ink-soft">{label}</dt>
                <dd className={`font-mono text-2xl font-semibold tabular-nums ${tone}`}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-ink-soft">
            Your share is almost halved, yet the stake is worth {multiple(f.exitMultiple)} what you paid — if the company
            ever sells for {compactMoney(f.exitCents)}, which is a hypothetical, not a forecast.
          </p>
          <button type="button" onClick={onOpen} className={`${primary} mt-6`}>
            Open this example in calculator →
          </button>
        </div>
      </div>
    </Section>
  )
}

export function Learn() {
  return (
    <CurrencyContext.Provider value={EXAMPLE_FACTS.currency}>
      <LearnBody />
    </CurrencyContext.Provider>
  )
}

function LearnBody() {
  const { money, compactMoney } = useMoney()
  const f = EXAMPLE_FACTS
  const blocks: Array<[string, string, string]> = [
    [
      'Equity: what your cheque buys',
      `Divide your investment by the post-money valuation. ${money(f.chequeCents)} ÷ ${money(f.postMoneyCents)} = ${ownership(f.initialOwnership)}.`,
      'Pre-money is the value before the round; post-money adds the new money in.',
    ],
    [
      'Dilution: why your percentage falls',
      `A Series A raising ${compactMoney(f.seriesA.raisedCents)} at ${compactMoney(f.seriesA.postMoneyCents)} post-money issues new shares worth a fifth of the company. You keep ${Math.round(f.seriesA.keptShare * 100)}% of your percentage: ${ownership(f.initialOwnership)} becomes ${ownership(f.seriesA.ownership)}.`,
      `Your paper value still rises, from ${money(f.chequeCents)} to ${money(f.seriesA.valueCents)}, because the company is worth more.`,
    ],
    [
      'Pro-rata: what it costs to keep your share',
      `Multiply your ownership by the round. Keeping ${ownership(f.initialOwnership)} through that Series A costs ${money(f.seriesA.proRataCents)}.`,
      'A new option pool in the same round adds your share of the pool to that amount.',
    ],
    [
      'Exit: what the stake could return',
      `At a sale, your ownership times the price is the starting point: ${ownership(f.finalOwnership)} of ${compactMoney(f.exitCents)} is ${money(f.exitProceedsCents)}.`,
      `Near or below the ${compactMoney(f.totalRaisedCents)} the company raised, investors with liquidation preferences are paid first, so you can receive less.`,
    ],
  ]
  return (
    <Section
      id="learn"
      eyebrow="The maths, briefly"
      title="From cheque to exit."
      lede="Your startup investment doesn’t stay static. See how your ownership changes as the company raises more capital — and what your stake could potentially become."
    >
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        {blocks.map(([title, main, aside]) => (
          <article key={title}>
            <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
            <p className="mt-2 text-ink-soft">{main}</p>
            <p className="mt-2 text-sm text-ink-faint">{aside}</p>
          </article>
        ))}
      </div>
    </Section>
  )
}

export function Faq() {
  return (
    <Section id="faq" eyebrow="FAQ" title="Frequently asked questions" tone="band">
      <div className="max-w-3xl divide-y divide-rule border-y border-rule">
        {FAQ.map(({ question, answer }) => (
          <details key={question} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-medium text-ink outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
              {question}
              <span aria-hidden="true" className="font-mono text-lg text-ink-faint transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-5 pr-8 text-ink-soft">{answer}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Optional, and shown only after the calculator. No email service is connected
 * yet, so a valid address is acknowledged honestly and goes nowhere — nothing
 * is sent, stored or logged until a provider is chosen.
 */
export function UpdatesSignup() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'invalid' | 'done'>('idle')
  const errorId = useId()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setState(EMAIL.test(email.trim()) ? 'done' : 'invalid')
  }

  const upcoming = ['Saved investments', 'Portfolio tracking', 'SAFE calculations', 'SPV and carry calculations', 'Advanced exit modelling', 'Term-sheet analysis']

  return (
    <Section
      id="updates"
      eyebrow="Coming next"
      title="Want more tools for angel investing?"
      lede="We’re building more tools for understanding and managing startup investments. Leave an email if you’d like to hear when they launch — the calculator stays free either way."
    >
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-3">
          <label htmlFor="updates-email" className="text-sm font-medium text-ink">
            Email address
          </label>
          <div className="flex gap-2">
            <input
              id="updates-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (state !== 'idle') setState('idle')
              }}
              aria-invalid={state === 'invalid' || undefined}
              aria-describedby={state === 'invalid' ? errorId : undefined}
              className="min-w-0 flex-1 border border-rule bg-surface px-3 py-2.5 text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
              placeholder="you@example.com"
            />
            <button type="submit" className={primary}>
              Notify me
            </button>
          </div>
          {state === 'invalid' ? (
            <p id={errorId} className="text-sm text-dilute">
              Enter a valid email address.
            </p>
          ) : null}
          <p role="status" className="text-sm text-ink-soft">
            {state === 'done'
              ? 'Thanks. Email updates aren’t switched on yet, so nothing was sent or stored — check back soon.'
              : ''}
          </p>
        </form>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 self-start text-sm text-ink-soft">
          {upcoming.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1 w-1 bg-accent" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

export function SiteFooter() {
  const links: Array<[string, string, string | undefined]> = [
    ['Calculator', '#calculator', 'calculator'],
    ['How it works', '#how-it-works', 'how-it-works'],
    ['FAQ', '#faq', 'faq'],
    ['Privacy', '/privacy', undefined],
    ['Terms', '/terms', undefined],
  ]
  return (
    <footer className="border-t border-rule bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <p className="font-semibold tracking-tight text-ink">Angel Investment Calculator</p>
          <p className="mt-2 text-sm text-ink-soft">Free tools for understanding startup investments.</p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {links.map(([text, href, section]) => (
              <li key={text}>
                <a
                  href={href}
                  onClick={
                    section
                      ? (e) => {
                          e.preventDefault()
                          scrollToSection(section)
                        }
                      : undefined
                  }
                  className="text-ink-soft outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {text}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 text-xs leading-relaxed text-ink-faint">
          <p>
            This calculator is provided for educational and informational purposes only. Results are hypothetical and
            depend on the assumptions entered. It does not constitute investment, legal, tax or financial advice.
            Actual investment outcomes may differ significantly.
          </p>
          <p>
            Modelled from the angel’s side only: instruments are priced at each round’s valuation, and other holders’
            terms beyond a 1× non-participating liquidation preference are not modelled.
          </p>
        </div>
      </div>
    </footer>
  )
}
