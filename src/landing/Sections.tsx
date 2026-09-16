import { useId, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { validateSignup } from '../server/waitlist'
import type { SignupField } from '../server/waitlist'
import { CurrencyContext, useMoney } from '../ui/currency'
import { multiple, percent } from '../ui/format'
import { EXAMPLE_FACTS } from './example'
import { Section, Wordmark } from './Section'
import { track } from '../analytics/track'
import { scrollToSection } from './scroll'


const primary =
  'inline-flex items-center rounded-full border border-accent bg-accent px-5 py-2.5 shadow-sm text-sm font-medium text-on-accent outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2'

export function Learn() {
  return (
    <CurrencyContext.Provider value={EXAMPLE_FACTS.currency}>
      <LearnBody />
    </CurrencyContext.Provider>
  )
}

interface Worked {
  title: string
  lede: string
  /** Each step is [what is being worked out, the arithmetic, its result]. */
  steps: Array<readonly [string, string, string]>
  note: string
}

function LearnBody() {
  const { money, compactMoney } = useMoney()
  const f = EXAMPLE_FACTS
  const pct = (fraction: number, places = 2) => percent(fraction, places)
  const blocks: Worked[] = [
    {
      title: 'Equity: what your cheque buys',
      lede: `You invest ${money(f.chequeCents)} in a ${f.entryLabel} round: ${compactMoney(f.preMoneyCents)} pre-money, raising ${compactMoney(f.raisedCents)}.`,
      steps: [
        ['Post-money valuation', `${money(f.preMoneyCents)} + ${money(f.raisedCents)}`, money(f.postMoneyCents)],
        ['Your ownership', `${money(f.chequeCents)} ÷ ${money(f.postMoneyCents)}`, pct(f.initialOwnership)],
      ],
      note: 'Pre-money is the company’s value before the round; post-money adds the new money. Your ownership is always your cheque divided by post-money.',
    },
    {
      title: 'Dilution: why your percentage falls',
      lede: `The ${f.next.label} raises ${compactMoney(f.next.raisedCents)} at a ${compactMoney(f.next.postMoneyCents)} post-money valuation, and you don’t invest.`,
      steps: [
        ['Share of the company sold', `${money(f.next.raisedCents)} ÷ ${money(f.next.postMoneyCents)}`, pct(f.next.sold, 0)],
        ['Share of your stake you keep', `100% − ${pct(f.next.sold, 0)}`, pct(f.next.kept, 0)],
        ['Your new ownership', `${pct(f.initialOwnership)} × ${pct(f.next.kept, 0)}`, pct(f.next.ownership, 3)],
        ['Your paper value', `${pct(f.next.ownership, 3)} × ${money(f.next.postMoneyCents)}`, money(f.next.valueCents)],
      ],
      note: `Your percentage fell, yet your paper value rose from ${money(f.chequeCents)} to ${money(f.next.valueCents)}, because the company grew faster than it diluted you.`,
    },
    {
      title: 'Pro-rata: what it costs to keep your share',
      lede: `To stay at ${pct(f.initialOwnership)} through the ${f.next.label}, you buy your share of the new money.`,
      steps: [
        ['Pro-rata cheque', `${pct(f.initialOwnership)} × ${money(f.next.raisedCents)}`, money(f.next.proRataCents)],
        [
          'Ownership after investing',
          `${pct(f.next.ownership, 3)} + (${money(f.next.proRataCents)} ÷ ${money(f.next.postMoneyCents)})`,
          pct(f.initialOwnership),
        ],
        ['Your paper value', `${pct(f.initialOwnership)} × ${money(f.next.postMoneyCents)}`, money(f.next.proRataValueCents)],
      ],
      note: `Investing ${money(f.next.proRataCents)} more lifts your paper value from ${money(f.next.valueCents)} to ${money(f.next.proRataValueCents)}. Skip it and your share falls to ${pct(f.next.ownership, 3)}.`,
    },
    {
      title: 'Exit: what your stake could return',
      lede: `You sit out every later round and the company sells for ${compactMoney(f.exitCents)}.`,
      steps: [
        [
          `Ownership after ${f.later.map((r) => r.label).join(', ').replace(/, ([^,]*)$/, ' and $1')}`,
          `${pct(f.initialOwnership)} × ${f.later.map((r) => pct(r.kept, 0)).join(' × ')}`,
          pct(f.finalOwnership, 4),
        ],
        ['Your proceeds', `${pct(f.finalOwnership, 4)} × ${money(f.exitCents)}`, money(f.exitProceedsCents)],
        ['Your multiple', `${money(f.exitProceedsCents)} ÷ ${money(f.chequeCents)}`, multiple(f.exitMultiple)],
        [
          `After ${pct(f.carry.percent, 0)} carry`,
          `${money(f.exitProceedsCents)} − ${pct(f.carry.percent, 0)} × (${money(f.exitProceedsCents)} − ${money(f.chequeCents)})`,
          `${money(f.carry.netCents)} · ${multiple(f.carry.netMultiple)}`,
        ],
      ],
      note: `Near or below the ${compactMoney(f.totalRaisedCents)} the company raised, liquidation preferences pay later investors first, so you can receive less than your percentage suggests.`,
    },
  ]
  return (
    <Section
      id="learn"
      eyebrow="The maths, briefly"
      title="How a small stake grows, shrinks and pays out"
      lede={`Four ideas decide what your cheque returns. Each is worked through with one example, ${money(f.chequeCents)} into a ${f.entryLabel} round, using the same engine as the calculator.`}
    >
      <div className="grid gap-6 md:grid-cols-2">
        {blocks.map((block) => (
          <article key={block.title} className="flex flex-col rounded-2xl border border-rule bg-surface p-5 shadow-card sm:p-6">
            <h3 className="text-lg font-semibold tracking-tight text-ink">{block.title}</h3>
            <p className="mt-2 text-ink-soft">{block.lede}</p>
            <ol className="mt-4 flex flex-col divide-y divide-rule border-y border-rule">
              {block.steps.map(([label, sum, result], i) => (
                <li key={label} className="py-2.5">
                  <p className="flex items-baseline gap-2 text-xs text-ink-faint">
                    <span className="font-mono tabular-nums text-accent">{i + 1}</span>
                    {label}
                  </p>
                  <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-mono text-sm tabular-nums">
                    <span className="text-ink-soft">{sum} =</span>
                    <span className="font-semibold text-ink">{result}</span>
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-ink-faint">{block.note}</p>
          </article>
        ))}
      </div>
    </Section>
  )
}

type SignupState = 'idle' | 'sending' | 'done' | 'unavailable' | 'failed'

const FIELD_ERRORS: Record<SignupField, string> = {
  firstName: 'Enter your first name.',
  lastName: 'Enter your surname.',
  email: 'Enter a valid email address.',
}

const input =
  'w-full rounded-xl border border-rule bg-surface px-3.5 py-2.5 text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 aria-[invalid=true]:border-dilute'

/**
 * The waiting list. Name, surname and email go to this site's own
 * `/api/waitlist`, which adds them to a Google Sheet; nothing is claimed as
 * saved until the server says it was.
 */
export function UpdatesSignup() {
  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', website: '' })
  const [errors, setErrors] = useState<readonly SignupField[]>([])
  const [state, setState] = useState<SignupState>('idle')
  const [joined, setJoined] = useState<{ firstName: string; email: string } | undefined>(undefined)
  const ids = { firstName: useId(), lastName: useId(), email: useId(), trap: useId() }

  const change = (field: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setValues((was) => ({ ...was, [field]: value }))
    if (errors.length > 0) setErrors((was) => was.filter((f) => f !== field))
    if (state === 'failed' || state === 'unavailable') setState('idle')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (state === 'sending') return
    const checked = validateSignup(values)
    if (!checked.ok) {
      setErrors(checked.fields)
      document.getElementById(ids[checked.fields[0] ?? 'email'])?.focus()
      return
    }
    setErrors([])
    setState('sending')
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...checked.signup, website: values.website }),
      })
      if (response.ok) {
        // The event says someone joined — never who.
        track({ name: 'email_submitted' })
        setJoined({ firstName: checked.signup.firstName, email: checked.signup.email })
        setState('done')
        return
      }
      setState(response.status === 503 ? 'unavailable' : 'failed')
    } catch {
      setState('failed')
    }
  }

  const field = (name: SignupField, label: string, autoComplete: string, type = 'text') => {
    const invalid = errors.includes(name)
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids[name]} className="text-sm font-medium text-ink">
          {label}
        </label>
        <input
          id={ids[name]}
          type={type}
          autoComplete={autoComplete}
          value={values[name]}
          onChange={change(name)}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${ids[name]}-error` : undefined}
          className={input}
        />
        {invalid ? (
          <p id={`${ids[name]}-error`} className="text-sm text-dilute">
            {FIELD_ERRORS[name]}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <Section
      id="updates"
      eyebrow="Coming next"
      align="center"
      title="More tools are on the way"
      lede="We’re building more tools for understanding and managing startup investments. Join the waiting list to hear when they launch. The calculator stays free either way."
    >
      <div>
        {state === 'done' && joined ? (
          <div role="status" className="mx-auto max-w-md rounded-2xl border border-gain/40 bg-gain/[0.06] p-5">
            <p className="font-semibold text-ink">You’re on the waiting list, {joined.firstName}.</p>
            <p className="mt-2 text-sm text-ink-soft">
              We’ll email <span className="font-medium text-ink">{joined.email}</span> when new tools launch. Nothing
              else, and you can ask to be removed at any time.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mx-auto flex max-w-md flex-col gap-4 text-left">
            <div className="grid gap-4 sm:grid-cols-2">
              {field('firstName', 'First name', 'given-name')}
              {field('lastName', 'Surname', 'family-name')}
            </div>
            {field('email', 'Email address', 'email', 'email')}
            {/* Hidden from people, tempting to bots. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor={ids.trap}>Website</label>
              <input id={ids.trap} type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={change('website')} />
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <button type="submit" disabled={state === 'sending'} className={`${primary} disabled:opacity-60`}>
                {state === 'sending' ? 'Joining…' : 'Join the waiting list'}
              </button>
              <p className="text-xs text-ink-faint">
                Used only to tell you about new tools. See{' '}
                <a href="/privacy" className="underline hover:text-ink">
                  Privacy
                </a>
                .
              </p>
            </div>
            <p role="status" className="text-center text-sm text-dilute">
              {state === 'failed'
                ? 'Something went wrong and your details weren’t saved. Please try again.'
                : state === 'unavailable'
                  ? 'The waiting list isn’t open yet, so your details weren’t saved. Please try again later.'
                  : ''}
            </p>
          </form>
        )}
      </div>
    </Section>
  )
}

export function SiteFooter() {
  const links: Array<[string, string, string | undefined]> = [
    ['Calculator', '#calculator', 'calculator'],
    ['Privacy', '/privacy', undefined],
    ['Terms', '/terms', undefined],
  ]
  return (
    <footer className="border-t border-rule bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <p className="text-lg text-ink">
            <Wordmark />
          </p>
          <p className="mt-2 text-sm text-ink-soft">Your tiny percent, from first cheque to exit. A free angel investment calculator.</p>
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
            Built from the angel’s side only. Every cheque is priced at its round’s valuation, and later investors are
            assumed to hold a standard 1× non-participating liquidation preference.
          </p>
        </div>
      </div>
    </footer>
  )
}
