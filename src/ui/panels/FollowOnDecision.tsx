import { useEffect, useId, useRef, useState } from 'react'
import { trackOnce } from '../../analytics/track'
import { ownAfter, postMoney, stakeValue } from '../../engine/ownership'
import { roundTerms } from '../../engine/scenario'
import type { RoundState } from '../../engine/scenario'
import type { Instrument, Round } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { InfoTip, MoneyField } from '../controls'
import { useMoney } from '../currency'
import { ownership, percent, roundName } from '../format'

/**
 * The follow-on decision for one round, always in view: invest your pro-rata,
 * invest another amount, or do not participate. A round you have just added
 * starts undecided and says so, because "not participating" should be a choice
 * rather than a default nobody noticed.
 *
 * Each option shows what you would own and what that is worth after the round.
 * They are priced from the round as it last ran (`state.round`), never from
 * what is mid-edit, because the engine throws on inputs with no answer.
 */

type Choice = 'none' | 'proRata' | 'custom'

const NO_FEE = { rule: 'percent' as const, percent: 0 }

export function FollowOnDecision({
  round,
  state,
  pending,
  dispatch,
  onDecided,
}: {
  round: Round
  state: RoundState
  /** Added in this session and not yet decided. */
  pending: boolean
  dispatch: (action: Action) => void
  onDecided: () => void
}) {
  const { money } = useMoney()
  const name = roundName(round)
  const cheque = round.participation
  const before = state.ownershipBefore
  const held = before > 0
  const titleId = useId()
  const amountId = useId()
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const [customMode, setCustomMode] = useState(false)

  useEffect(() => {
    if (held) trackOnce({ name: 'pro_rata_scenario_viewed' })
  }, [held])

  const terms = roundTerms(state.round)
  const post = postMoney(terms)
  const amount = cheque?.amountCents ?? 0
  const derived: Choice | undefined = pending
    ? undefined
    : !cheque
      ? 'none'
      : held && amount > 0 && amount === state.proRataCents
        ? 'proRata'
        : 'custom'
  const choice: Choice | undefined = customMode && cheque ? 'custom' : derived

  const outcome = (invested: number) => {
    const own = ownAfter(before, terms, invested)
    return { own, value: stakeValue(own, post), change: held ? own / before - 1 : undefined }
  }
  const participate = (patch: Partial<Instrument>) =>
    dispatch({ type: 'round:participate', id: round.id, patch: { ...(cheque ?? { type: 'equity', amountCents: 0, entryFee: NO_FEE }), ...patch } })

  const choose = (next: Choice) => {
    if (next === 'none') dispatch({ type: 'round:sitOut', id: round.id })
    if (next === 'proRata') participate({ amountCents: state.proRataCents })
    if (next === 'custom') participate({ amountCents: amount })
    setCustomMode(next === 'custom')
    onDecided()
  }

  const options: Array<{ key: Choice; title: string; label: string; invested: number | undefined }> = [
    { key: 'none', title: 'Don’t participate', label: `Don’t participate in ${name}`, invested: 0 },
    ...(held
      ? [{ key: 'proRata' as const, title: `Invest pro-rata · ${money(state.proRataCents)}`, label: `Invest pro-rata, ${money(state.proRataCents)}`, invested: state.proRataCents }]
      : []),
    { key: 'custom', title: held ? 'Invest another amount' : 'Invest', label: held ? 'Invest another amount' : `Invest in ${name}`, invested: choice === 'custom' ? amount : undefined },
  ]
  const current = options.findIndex((o) => o.key === choice)
  const move = (from: number, step: number) => {
    const next = (from + step + options.length) % options.length
    const option = options[next]
    if (!option) return
    choose(option.key)
    refs.current[next]?.focus()
  }
  const change = (c: number | undefined) =>
    c === undefined || Math.abs(c) < 1e-9 ? (held ? 'no dilution' : '') : `${c > 0 ? '+' : '−'}${Math.abs(c * 100).toFixed(1)}% of your share`

  return (
    <div className={`mt-4 rounded-2xl border p-4 sm:p-5 ${pending ? 'border-dilute/60 bg-dilute/[0.06]' : 'border-accent/30 bg-accent-wash/40'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id={titleId} className="font-medium text-ink">
          Do you invest in {name}?
        </h4>
        {pending ? (
          <span role="status" className="rounded-full bg-dilute/10 px-2.5 py-1 text-xs font-medium text-dilute">
            Decision needed
          </span>
        ) : null}
      </div>

      {held ? (
        <div className="mt-2">
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
            <span>
              Your pro-rata is{' '}
              <strong className="font-mono tabular-nums text-ink">{money(state.proRataCents)}</strong>: what it takes to
              keep your {ownership(before)}
            </span>
            <InfoTip term="proRata" />
          </p>
          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-ink-faint">
            {ownership(before)} × {money(round.raisedCents)} raised
            {terms.newOptionPool ? ` + your share of the ${percent(terms.newOptionPool, 0)} new option pool` : ''}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">This round comes before your first cheque, so there is no position to keep yet.</p>
      )}

      <div role="radiogroup" aria-labelledby={titleId} className={`mt-3 grid gap-2 ${held ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {options.map((option, i) => {
          const checked = option.key === choice
          const result = option.invested === undefined ? undefined : outcome(option.invested)
          return (
            <button
              key={option.key}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={option.label}
              tabIndex={checked || (current === -1 && i === 0) ? 0 : -1}
              onClick={() => choose(option.key)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  move(i, 1)
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  move(i, -1)
                }
              }}
              className={`flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/40 ${
                checked ? 'border-accent bg-surface shadow-[inset_0_0_0_1px_var(--color-accent)] shadow-card' : 'border-rule bg-surface/70 hover:-translate-y-px hover:border-rule-strong hover:shadow-card motion-reduce:hover:translate-y-0'
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm font-medium text-ink">
                {option.title}
                <span
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 shrink-0 rounded-full border ${checked ? 'border-accent bg-accent shadow-[inset_0_0_0_2px_var(--color-surface)]' : 'border-rule-strong'}`}
                />
              </span>
              {result ? (
                <span className="font-mono text-xs tabular-nums text-ink-soft">
                  you own <span className="text-ink">{ownership(result.own)}</span> · <span className="text-gain">{money(result.value)}</span>
                  <br />
                  <span className={result.change !== undefined && result.change < -1e-9 ? 'text-dilute' : 'text-ink-faint'}>{change(result.change)}</span>
                </span>
              ) : (
                <span className="text-xs text-ink-faint">Enter the amount you invest</span>
              )}
            </button>
          )
        })}
      </div>

      {choice === 'custom' ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <MoneyField id={amountId} label="Your follow-on investment" valueCents={amount} onChange={(amountCents) => participate({ amountCents })} placeholder="e.g. 2,500" />
          <p className={`self-end pb-2 text-sm ${amount > 0 ? 'text-ink-soft' : 'text-dilute'}`}>
            {amount <= 0
              ? 'Enter the amount you invest, or choose “Don’t participate”.'
              : held && state.proRataCents > 0
                ? `${Math.round((amount / state.proRataCents) * 100)}% of your pro-rata`
                : null}
          </p>
        </div>
      ) : null}
    </div>
  )
}
