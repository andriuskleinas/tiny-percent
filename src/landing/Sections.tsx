import { useId, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { validateSignup } from '../server/waitlist'
import type { SignupField } from '../server/waitlist'
import { CoffeeButton } from '../ui/Coffee'
import { CurrencyContext, useMoney } from '../ui/currency'
import { multiple, ownership, percent } from '../ui/format'
import { EXAMPLE_FACTS } from './example'
import { INSTRUMENT_FACTS } from './instruments'
import { Section, Wordmark } from './Section'
import { track } from '../analytics/track'
import { scrollToSection } from './scroll'
import { SITE } from '../site'


const primary =
  'inline-flex items-center rounded-full border border-accent bg-accent px-5 py-2.5 shadow-sm text-sm font-medium text-on-accent outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2'

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
  const pct = (fraction: number, places = 2) => percent(fraction, places)
  const later = f.later.map((r) => r.label).join(', ').replace(/, ([^,]*)$/, ' and $1')
  const cards: CardData[] = [
    {
      name: 'Equity',
      tagline: 'What your cheque buys.',
      point: { label: 'Key idea.', text: 'Your ownership is your cheque divided by the post-money valuation.' },
      example: `${money(f.chequeCents)} into a ${f.entryLabel} round: ${compactMoney(f.preMoneyCents)} pre-money, raising ${compactMoney(f.raisedCents)}.`,
      steps: [
        { label: 'Post-money valuation', sum: `${money(f.preMoneyCents)} + ${money(f.raisedCents)}`, result: money(f.postMoneyCents) },
        { label: 'Your ownership', sum: `${money(f.chequeCents)} ÷ ${money(f.postMoneyCents)}`, result: pct(f.initialOwnership), wins: true },
      ],
      note: 'Pre-money is the value before the round. Post-money adds the new money.',
    },
    {
      name: 'Dilution',
      tagline: 'Why your percentage falls.',
      point: { label: 'Key idea.', text: 'Each round sells part of the company, so you keep a smaller slice of a bigger company.' },
      example: `The ${f.next.label} raises ${compactMoney(f.next.raisedCents)} at ${compactMoney(f.next.postMoneyCents)} post-money. You don’t invest.`,
      steps: [
        { label: 'Share of the company sold', sum: `${money(f.next.raisedCents)} ÷ ${money(f.next.postMoneyCents)}`, result: pct(f.next.sold, 0) },
        { label: 'Share of your stake you keep', sum: `100% − ${pct(f.next.sold, 0)}`, result: pct(f.next.kept, 0) },
        { label: 'Your new ownership', sum: `${pct(f.initialOwnership)} × ${pct(f.next.kept, 0)}`, result: pct(f.next.ownership, 3) },
        { label: 'Your paper value', sum: `${pct(f.next.ownership, 3)} × ${money(f.next.postMoneyCents)}`, result: money(f.next.valueCents), wins: true },
      ],
      note: `Your percentage fell, yet ${money(f.chequeCents)} became ${money(f.next.valueCents)}: the company grew faster than it diluted you.`,
    },
    {
      name: 'Pro-rata',
      tagline: 'What it costs to keep your share.',
      point: { label: 'Key idea.', text: 'To hold your percentage, buy your share of each new round.' },
      example: `Stay at ${pct(f.initialOwnership)} through the ${f.next.label}.`,
      steps: [
        { label: 'Pro-rata cheque', sum: `${pct(f.initialOwnership)} × ${money(f.next.raisedCents)}`, result: money(f.next.proRataCents) },
        {
          label: 'Ownership after investing',
          sum: `${pct(f.next.ownership, 3)} + (${money(f.next.proRataCents)} ÷ ${money(f.next.postMoneyCents)})`,
          result: pct(f.initialOwnership),
        },
        { label: 'Your paper value', sum: `${pct(f.initialOwnership)} × ${money(f.next.postMoneyCents)}`, result: money(f.next.proRataValueCents), wins: true },
      ],
      note: `Skip it and you fall to ${pct(f.next.ownership, 3)}, worth ${money(f.next.valueCents)}.`,
    },
    {
      name: 'Exit',
      tagline: 'What your stake could return.',
      point: { label: 'Key idea.', text: 'Your payout is your final percentage of the sale price, less carry.' },
      example: `You sit out every later round. The company sells for ${compactMoney(f.exitCents)}.`,
      steps: [
        {
          label: `Ownership after ${later}`,
          sum: `${pct(f.initialOwnership)} × ${f.later.map((r) => pct(r.kept, 0)).join(' × ')}`,
          result: pct(f.finalOwnership, 4),
        },
        { label: 'Your proceeds', sum: `${pct(f.finalOwnership, 4)} × ${money(f.exitCents)}`, result: money(f.exitProceedsCents) },
        { label: 'Your multiple', sum: `${money(f.exitProceedsCents)} ÷ ${money(f.chequeCents)}`, result: multiple(f.exitMultiple) },
        {
          label: `After ${pct(f.carry.percent, 0)} carry`,
          sum: `${money(f.exitProceedsCents)} − ${pct(f.carry.percent, 0)} × (${money(f.exitProceedsCents)} − ${money(f.chequeCents)})`,
          result: `${money(f.carry.netCents)} · ${multiple(f.carry.netMultiple)}`,
          wins: true,
        },
      ],
      note: `Near or below the ${compactMoney(f.totalRaisedCents)} the company raised, preferences pay later investors first.`,
    },
  ]
  return (
    <Section
      id="learn"
      eyebrow="The maths, briefly"
      title="How a small stake grows, shrinks and pays out"
    >
      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((card) => (
          <StepCard key={card.name} card={card} />
        ))}
      </div>
    </Section>
  )
}

interface CardData {
  name: string
  /** The one idea, in a sentence. */
  tagline: string
  /** The takeaway, drawn as if highlighted with a marker. */
  point?: { label: string; text: string } | undefined
  example?: string | undefined
  /** `wins` marks the result that matters. */
  steps: Array<{ label: string; sum: string; result: string; wins?: boolean }>
  /** Said beside the result that matters, where it helps. */
  tag?: string | undefined
  note?: string | undefined
  /** When it fits best, folded away. */
  bestFor?: string | undefined
}

/**
 * Short by design: a name, one sentence, the takeaway highlighted, the
 * arithmetic, and the result that matters picked out. Anything more is one click
 * away rather than in the way of the numbers.
 */
function StepCard({ card }: { card: CardData }) {
  return (
    <article className="flex flex-col rounded-2xl border border-rule bg-surface p-5 shadow-card sm:p-6">
      <h3 className="text-lg font-semibold tracking-tight text-ink">{card.name}</h3>
      <p className="mt-1 text-ink-soft">{card.tagline}</p>
      {card.point ? (
        <p className="mt-3 text-sm leading-relaxed text-ink">
          <span className="marker">
            <span className="font-semibold">{card.point.label}</span> {card.point.text}
          </span>
        </p>
      ) : null}
      {card.example ? <p className="mt-4 text-sm text-ink-faint">{card.example}</p> : null}
      <dl className="mt-3 flex flex-col gap-1">
        {card.steps.map((step) => (
          <div
            key={step.label}
            className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 ${step.wins ? 'bg-accent-wash' : 'bg-sunk/60'}`}
          >
            <dt className="w-full text-xs text-ink-faint">
              {step.label}
              {step.wins && card.tag ? <span className="ml-2 font-semibold text-accent">{card.tag}</span> : null}
            </dt>
            <dd className="font-mono text-sm tabular-nums text-ink-soft">{step.sum} =</dd>
            <dd className={`ml-auto font-mono text-sm font-semibold tabular-nums ${step.wins ? 'text-accent' : 'text-ink'}`}>{step.result}</dd>
          </div>
        ))}
      </dl>
      {card.note ? <p className="mt-3 text-sm text-ink-faint">{card.note}</p> : null}
      {card.bestFor ? (
        <details className="group mt-auto pt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-accent outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="font-mono transition-transform group-open:rotate-45">
              +
            </span>
            When it works best
          </summary>
          <p className="mt-2 text-sm text-ink-soft">
            <span className="font-medium text-ink">Best for</span> {card.bestFor}
          </p>
        </details>
      ) : null}
    </article>
  )
}

export function Instruments() {
  return (
    <CurrencyContext.Provider value={INSTRUMENT_FACTS.currency}>
      <InstrumentsBody />
    </CurrencyContext.Provider>
  )
}

/**
 * Shares, SAFE and convertible note, side by side: one cheque at one valuation,
 * invested three ways into the same next round. Every figure is from
 * `INSTRUMENT_FACTS`, which runs each deal through the engine.
 */
function InstrumentsBody() {
  const { money, compactMoney } = useMoney()
  const f = INSTRUMENT_FACTS
  // Stakes this small need a third decimal below 0.1%, as the calculator shows them.
  const pct = (fraction: number, places?: number) => (places === undefined ? ownership(fraction) : percent(fraction, places))
  const cheque = money(f.chequeCents)
  const cap = money(f.capCents)
  const seedPost = money(f.seed.postMoneyCents)
  const kept = pct(f.seed.kept, 0)
  const offPrice = pct(1 - f.discount, 0)

  const higher = (won: boolean) => (won ? { wins: true } : {})
  const cards: CardData[] = [
    {
      name: 'Shares',
      tagline: 'Your price is set today.',
      example: `${cheque} at a ${compactMoney(f.capCents)} valuation, then a ${f.seed.label} that sells ${pct(1 - f.seed.kept, 0)}.`,
      steps: [
        { label: 'Today', sum: `${cheque} ÷ ${cap}`, result: pct(f.shares.initialOwnership) },
        { label: `After the ${f.seed.label}`, sum: `${pct(f.shares.initialOwnership)} × ${kept}`, result: pct(f.shares.ownership), wins: true },
      ],
      point: { label: 'Why it exists.', text: 'Certainty, and full shareholder rights from day one. The cost is negotiating a valuation and a full set of legal documents.' },
      bestFor: 'companies with traction, raising a sizeable round with a lead investor.',
    },
    {
      name: 'SAFE',
      tagline: 'Your price is set at the next round.',
      example: `${compactMoney(f.capCents)} cap, ${pct(f.discount, 0)} discount. The ${f.seed.label} values the company at ${compactMoney(f.seed.postMoneyCents)}.`,
      steps: [
        { label: 'At the cap', sum: `${cheque} ÷ ${cap} × ${kept}`, result: pct(f.safe.routes.cap), ...higher(f.safe.winner === 'cap') },
        { label: 'At the discount', sum: `${cheque} ÷ (${offPrice} × ${seedPost})`, result: pct(f.safe.routes.discount), ...higher(f.safe.winner === 'discount') },
      ],
      note: 'You get whichever is higher. No interest, nothing to repay.',
      point: { label: 'Why it exists.', text: 'Nobody can price a company this early, so the next round does it, and the cap and discount reward you for going first. Short, cheap and quick to sign.' },
      bestFor: 'very early companies and small cheques, with a priced round expected within a year or two. The US standard.',
    },
    {
      name: 'Convertible note',
      tagline: 'A loan that turns into shares.',
      example: `The same terms, plus ${pct(f.interestRate, 0)} interest a year. The ${f.seed.label} comes ${f.years} years later.`,
      steps: [
        { label: 'Loan plus interest', sum: `${cheque} × (1 + ${pct(f.interestRate, 0)} × ${f.years})`, result: money(f.note.convertingCents) },
        { label: 'At the cap', sum: `${money(f.note.convertingCents)} ÷ ${cap} × ${kept}`, result: pct(f.note.routes.cap), ...higher(f.note.winner === 'cap') },
        {
          label: 'At the discount',
          sum: `${money(f.note.convertingCents)} ÷ (${offPrice} × ${seedPost})`,
          result: pct(f.note.routes.discount),
          ...higher(f.note.winner === 'discount'),
        },
      ],
      note: `The ${money(f.note.convertingCents - f.chequeCents)} of interest converts, but it isn’t money you paid.`,
      point: { label: 'Why it exists.', text: 'A SAFE with a lender’s protections: interest, a maturity date, and a place ahead of shareholders. Often the more familiar contract in Europe.' },
      bestFor: 'bridge rounds, markets where SAFEs aren’t standard, and investors who want a deadline.',
    },
    {
      name: 'If the next round is cheaper',
      tagline: `The ${f.seed.label} values the company at ${compactMoney(f.cheapSeed.postMoneyCents)}, below the ${compactMoney(f.capCents)} cap.`,
      steps: [
        { label: 'Shares', sum: `${pct(f.shares.initialOwnership)} × ${pct(f.cheapSeed.kept, 0)}`, result: pct(f.shares.cheapOwnership) },
        { label: 'SAFE at the cap', sum: `${cheque} ÷ ${cap} × ${pct(f.cheapSeed.kept, 0)}`, result: pct(f.cheapSafe.routes.cap) },
        {
          label: 'SAFE at the discount',
          sum: `${cheque} ÷ (${offPrice} × ${money(f.cheapSeed.postMoneyCents)})`,
          result: pct(f.cheapSafe.routes.discount),
          ...higher(f.cheapSafe.winner === 'discount'),
        },
        {
          label: 'Note at the cap',
          sum: `${money(f.cheapNote.convertingCents)} ÷ ${cap} × ${pct(f.cheapSeed.kept, 0)}`,
          result: pct(f.cheapNote.routes.cap),
          ...higher(f.cheapNote.winner === 'cap'),
        },
        {
          label: 'Note at the discount',
          sum: `${money(f.cheapNote.convertingCents)} ÷ (${offPrice} × ${money(f.cheapSeed.postMoneyCents)})`,
          result: pct(f.cheapNote.routes.discount),
          ...higher(f.cheapNote.winner === 'discount'),
        },
      ],
      note: 'The discount more than doubles the SAFE’s stake, and the note’s interest converts on top. Shares can’t be repriced.',
    },
  ]

  const facts: Array<readonly [string, string, string, string]> = [
    ['Your price is set', 'Today', 'At the next priced round', 'At the next priced round'],
    ['Until then you hold', 'Shares', 'A right to future shares', 'A loan'],
    ['Interest', 'None', 'None', 'Yes, and it converts too'],
    ['If no round ever comes', 'You keep your shares', 'It waits, with no end date', 'Repaid, converted or extended at maturity'],
  ]
  // Each stake is valued at the Seed's own price: ownership × its post-money.
  const stake = (question: string, postMoneyCents: number, owned: readonly number[]) => {
    const worth = owned.map((o) => Math.round(o * postMoneyCents))
    return { question, owned, worth, most: Math.max(...worth) }
  }
  const stakes = [
    stake(`${f.seed.label} at ${compactMoney(f.seed.postMoneyCents)}`, f.seed.postMoneyCents, [
      f.shares.ownership,
      f.safe.ownership,
      f.note.ownership,
    ]),
    stake(`${f.seed.label} at ${compactMoney(f.cheapSeed.postMoneyCents)}, below the cap`, f.cheapSeed.postMoneyCents, [
      f.shares.cheapOwnership,
      f.cheapSafe.ownership,
      f.cheapNote.ownership,
    ]),
  ]
  const capShort = compactMoney(f.capCents)
  const terms = `${capShort} cap, ${pct(f.discount, 0)} discount`
  const columns = [
    { name: 'Shares', blurb: 'Priced today', terms: `${pct(f.shares.initialOwnership)} of the company at ${capShort}` },
    { name: 'SAFE', blurb: 'Priced at the next round', terms },
    { name: 'Convertible note', blurb: 'A loan, priced later', terms: `${terms}, ${pct(f.interestRate, 0)} a year` },
  ] as const
  const groupHeading = 'bg-sunk/60 px-5 py-2 text-left font-mono text-xs font-bold uppercase tracking-wider text-ink'
  // The deal restated where the comparison starts, so the table reads on its own.
  const deal = (
    <>
      One <strong className="font-mono font-semibold text-ink">{cheque}</strong> cheque at a{' '}
      <strong className="font-mono font-semibold text-ink">{capShort}</strong> valuation, invested three ways, then valued after the{' '}
      {f.seed.label}.
    </>
  )

  return (
    <Section
      id="instruments"
      eyebrow="Three ways to invest"
      title="Shares, SAFE or convertible note?"
    >
      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((card) => (
          <StepCard key={card.name} card={{ ...card, tag: 'You get this' }} />
        ))}
      </div>

      <h3 className="mt-12 text-lg font-semibold tracking-tight text-ink">Side by side</h3>
      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-rule bg-surface shadow-card sm:block">
        <p className="border-b border-rule bg-accent-wash px-5 py-4 text-base text-ink-soft">{deal}</p>
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">Shares, SAFE and convertible note compared</caption>
          <thead>
            <tr className="border-b border-rule text-left align-top">
              <th scope="col" className="w-1/4 px-5 pt-5 pb-4 font-normal">
                <span className="sr-only">Question</span>
              </th>
              {columns.map((c) => (
                <th key={c.name} scope="col" className="px-5 pt-5 pb-4 font-normal">
                  <span className="block text-base font-semibold tracking-tight text-ink">{c.name}</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">{c.blurb}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="colgroup" colSpan={4} className={groupHeading}>
                What you put in
              </th>
            </tr>
            <tr className="border-b border-rule align-top transition-colors last:border-0 hover:bg-sunk/30">
              <th scope="row" className="px-5 py-4 text-left font-medium text-ink-soft">
                Your cheque
              </th>
              {columns.map((c) => (
                <td key={c.name} className="px-5 py-4">
                  <span className="block font-mono text-lg font-semibold tabular-nums text-ink">{cheque}</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">{c.terms}</span>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="colgroup" colSpan={4} className={groupHeading}>
                How it works
              </th>
            </tr>
            {facts.map(([question, ...answers]) => (
              <tr key={question} className="border-b border-rule align-top transition-colors last:border-0 hover:bg-sunk/30">
                <th scope="row" className="px-5 py-3.5 text-left font-medium text-ink-soft">
                  {question}
                </th>
                {answers.map((a, i) => (
                  <td key={columns[i]?.name} className={`px-5 py-3.5 ${a === 'None' ? 'text-ink-faint' : 'text-ink'}`}>
                    {a}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="colgroup" colSpan={4} className={groupHeading}>
                What your {cheque} is worth after the {f.seed.label}
              </th>
            </tr>
            {stakes.map(({ question, owned, worth, most }) => (
              <tr key={question} className="border-b border-rule align-top transition-colors last:border-0 hover:bg-sunk/30">
                <th scope="row" className="px-5 py-4 text-left font-medium text-ink-soft">
                  {question}
                </th>
                {worth.map((w, i) => (
                  <td key={columns[i]?.name} className="px-5 py-4">
                    <span className={`block font-mono text-lg font-semibold tabular-nums ${w === most ? 'text-accent' : 'text-ink'}`}>
                      {money(w)}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-faint">{pct(owned[i] ?? 0)} owned</span>
                    <span className="block text-xs text-ink-faint">{multiple(w / f.chequeCents)} return</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-col gap-4 sm:hidden">
        <p className="rounded-2xl bg-accent-wash px-4 py-3 text-sm text-ink-soft">{deal}</p>
        {columns.map((c, i) => (
          <div key={c.name} className="rounded-2xl border border-rule bg-surface p-4 shadow-card">
            <p className="font-semibold text-ink">{c.name}</p>
            <p className="text-xs text-ink-faint">{c.blurb}</p>
            <dl className="mt-2 flex flex-col divide-y divide-rule text-sm">
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-ink-faint">Your cheque</dt>
                <dd className="text-right">
                  <span className="block font-mono font-semibold tabular-nums text-ink">{cheque}</span>
                  <span className="block text-xs text-ink-faint">{c.terms}</span>
                </dd>
              </div>
              {facts.map(([question, ...answers]) => (
                <div key={question} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-ink-faint">{question}</dt>
                  <dd className="text-right text-ink">{answers[i]}</dd>
                </div>
              ))}
              {stakes.map(({ question, owned, worth, most }) => {
                const w = worth[i] ?? 0
                return (
                  <div key={question} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-ink-faint">{question}</dt>
                    <dd className="text-right">
                      <span className={`block font-mono font-semibold tabular-nums ${w === most ? 'text-accent' : 'text-ink'}`}>{money(w)}</span>
                      <span className="block text-xs text-ink-faint">{pct(owned[i] ?? 0)} owned</span>
                      <span className="block text-xs text-ink-faint">{multiple(w / f.chequeCents)} return</span>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-ink-faint">
        Want to try your own terms? Pick SAFE or Convertible note under “What you are buying” in the calculator above.
      </p>
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
    <footer className="footer-black border-t border-rule bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <p className="text-lg text-ink">
            <Wordmark />
          </p>
          <p className="mt-2 text-sm text-ink-soft">Your tiny percent, from first cheque to exit. A free angel investment calculator.</p>
          {SITE.supportUrl ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <CoffeeButton placement="footer" size="sm" />
              <span className="text-xs text-ink-faint">Free, no ads. Supported by people who use it.</span>
            </div>
          ) : null}
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
