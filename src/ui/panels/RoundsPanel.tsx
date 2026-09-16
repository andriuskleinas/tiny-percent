import { useState } from 'react'
import { useMoney } from '../currency'
import { ROUND_LABELS } from '../../engine/types'
import type { Round } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { Button, InfoTip, MoneyField, Panel, SelectField, SwitchField, TextField } from '../controls'
import { ownership, roundName } from '../format'
import { FollowOnDecision } from './FollowOnDecision'
import type { RoundState } from '../../engine/scenario'

/** A value no round name can take: names are trimmed and at most 40 characters. */
const OTHER = ' other '

const VALUATION_BASIS = [
  ['pre', 'Pre-money'],
  ['post', 'Post-money'],
] as const

function isPreset(label: string): boolean {
  return (ROUND_LABELS as readonly string[]).includes(label)
}

export function RoundsPanel({
  rounds,
  names,
  states,
  pending,
  onAdded,
  onDecided,
  dispatch,
}: {
  /** Follow-on rounds only — the entry (`rounds[0]`) has its own panel. */
  rounds: Round[]
  /** Every round's name, entry included, so a name typed once can be picked again. */
  names: string[]
  /** Every round's computed state, entry included, in date order. */
  states: RoundState[]
  /**
   * Rounds added in this visit whose follow-on decision is not made yet. Not
   * part of the scenario: a shared link has no undecided rounds, only cheques.
   */
  pending: ReadonlySet<string>
  onAdded: (id: string) => void
  onDecided: (id: string) => void
  dispatch: (action: Action) => void
}) {
  const { money } = useMoney()
  // Rounds whose reader chose "Other" and is typing a name. While they type,
  // the dropdown stays on "Other" instead of jumping to the half-typed name.
  const [naming, setNaming] = useState<ReadonlySet<string>>(new Set())
  const setNamingFor = (id: string, on: boolean) =>
    setNaming((was) => {
      const next = new Set(was)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const add = () => {
    const id = `r${Date.now().toString(36)}${rounds.length}`
    dispatch({ type: 'round:add', id })
    onAdded(id)
  }
  const addRound = (
    <Button tone="primary" onClick={add}>
      + Add funding round
    </Button>
  )

  return (
    <Panel
      id="future-rounds"
      title="Future funding rounds"
      lede="Each time the company raises money it issues new shares, so your percentage falls unless you invest again. For each round, choose whether to use your pro-rata right."
      // With rounds open the button moves below the last card, where the reader already is.
      aside={rounds.length === 0 ? addRound : undefined}
    >
      {rounds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-rule-strong bg-ground/40 px-5 py-8 text-center">
          <p className="text-sm text-ink-soft">
            No later rounds yet. Add a Series A to see how new money{' '}
            <span className="inline-flex items-center gap-1">
              dilutes you <InfoTip term="dilution" />
            </span>{' '}
            and what it would cost to keep your share.
          </p>
        </div>
      ) : null}

      <div className={`flex flex-col gap-6 ${rounds.length === 0 ? 'mt-8' : ''}`}>
        {rounds.map((round) => {
          const state = states.find((s) => s.round.id === round.id)
          const set = (patch: Partial<Round>) => dispatch({ type: 'round:set', id: round.id, patch })
          const cheque = round.participation
          const name = roundName(round)
          const undecided = pending.has(round.id)

          return (
            <article key={round.id} aria-label={name} className={`relative rounded-2xl border bg-ground/40 p-4 sm:p-5 ${undecided ? 'border-dilute/60' : 'border-rule'}`}>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                title={`Remove ${name}`}
                onClick={() => dispatch({ type: 'round:remove', id: round.id })}
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-faint outline-none transition-colors hover:bg-dilute/10 hover:text-dilute focus-visible:ring-2 focus-visible:ring-accent/40 sm:right-3 sm:top-3"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7h16" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                  <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
                </svg>
              </button>

              <header className="pr-10">
                <h3 className="font-semibold text-ink">{name}</h3>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-ink-faint">
                  {money(round.raisedCents)} at {money(state?.postMoneyCents ?? round.valuationCents)} post-money · {round.date.slice(0, 4)}
                  {undecided ? ' · decision needed' : cheque && cheque.amountCents > 0 ? ` · you invest ${money(cheque.amountCents)}` : cheque ? '' : ' · you don’t participate'}
                </p>
                {state ? (
                  <p className="mt-1 font-mono text-xs tabular-nums text-ink-faint">
                    you own <span className="text-ink">{ownership(state.ownershipAfter)}</span>
                    {' · '}
                    <span className="text-gain">{money(state.stakeValueCents)}</span> paper value
                  </p>
                ) : null}
              </header>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(() => {
                  const typing = naming.has(round.id)
                  // Standard names, then names typed for any round, then "Other".
                  const custom = [...new Set(names.map((n) => n.trim()))].filter(
                    (n) => n !== '' && !isPreset(n) && !(typing && n === round.label.trim()),
                  )
                  const options: Array<readonly [string, string]> = [
                    ...ROUND_LABELS.map((label) => [label, label] as const),
                    ...custom.map((label) => [label, label] as const),
                    [OTHER, 'Other…'],
                  ]
                  const listed = isPreset(round.label) || custom.includes(round.label.trim())
                  const showName = typing || !listed
                  return (
                    <>
                      <SelectField
                        label="Round"
                        value={showName ? OTHER : round.label.trim()}
                        options={options}
                        onChange={(label) => {
                          setNamingFor(round.id, label === OTHER)
                          set({ label: label === OTHER ? '' : label })
                        }}
                      />
                      {showName ? (
                        <TextField
                          label="Round name"
                          value={round.label}
                          placeholder="e.g. Bridge"
                          autoFocus={typing}
                          onChange={(label) => set({ label: label.slice(0, 40) })}
                        />
                      ) : null}
                    </>
                  )
                })()}
                <TextField label="Round date" type="date" value={round.date} onChange={(date) => set({ date })} />
                <MoneyField label="Amount raised" valueCents={round.raisedCents} onChange={(raisedCents) => set({ raisedCents })} />
                <MoneyField
                  label="Company valuation"
                  info={round.valuationBasis === 'pre' ? 'preMoney' : 'postMoney'}
                  valueCents={round.valuationCents}
                  onChange={(valuationCents) => set({ valuationCents })}
                />
                <SwitchField label="Valuation basis" info="valuationBasis" value={round.valuationBasis} options={VALUATION_BASIS} onChange={(valuationBasis) => set({ valuationBasis })} />
              </div>

              {state ? (
                <FollowOnDecision round={round} state={state} pending={undecided} dispatch={dispatch} onDecided={() => onDecided(round.id)} />
              ) : null}

            </article>
          )
        })}
      </div>

      {rounds.length > 0 ? <div className="mt-6 flex justify-center">{addRound}</div> : null}
    </Panel>
  )
}
