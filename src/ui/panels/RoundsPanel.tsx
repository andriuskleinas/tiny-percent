import { useEffect, useState } from 'react'
import { trackOnce } from '../../analytics/track'
import { useMoney } from '../currency'
import { ownAfter, postMoney, stakeValue } from '../../engine/ownership'
import { roundTerms } from '../../engine/scenario'
import type { RoundState } from '../../engine/scenario'
import { ROUND_LABELS } from '../../engine/types'
import type { Instrument, InstrumentType, Round } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { AreaWealth } from '../charts/AreaWealth'
import { Button, Disclosure, InfoTip, MoneyField, Panel, PercentField, SelectField, SwitchField, TextField } from '../controls'
import { INSTRUMENT_NOTE, ownership, roundName } from '../format'
import { DilutionTable } from './DilutionTable'
import { hasEntryFee } from '../facts'
import { EntryFeeFields } from './EntryFeeFields'

const CUSTOM = 'custom'

const LABEL_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ...ROUND_LABELS.map((label) => [label, label] as const),
  [CUSTOM, 'Custom name…'],
]

const TYPES: ReadonlyArray<readonly [InstrumentType, string]> = [
  ['equity', 'Priced equity'],
  ['safe', 'SAFE'],
  ['cla', 'Convertible loan (CLA)'],
]

const VALUATION_BASIS = [
  ['pre', 'Pre-money'],
  ['post', 'Post-money'],
] as const

const PARTICIPATE = [
  ['no', 'No'],
  ['yes', 'Yes'],
] as const

const NO_FEE = { rule: 'percent' as const, percent: 0 }

function isPreset(label: string): boolean {
  return (ROUND_LABELS as readonly string[]).includes(label)
}

interface Strategy {
  title: string
  chequeCents: number
  ownership: number
  valueCents: number
}

/**
 * The three answers to "should I follow on?" for one round. Priced from the
 * round as it last ran (`state.round`), never from what is mid-edit, because
 * the engine throws on inputs with no answer and a throw here would blank the
 * page.
 */
function strategies(state: RoundState): [Strategy, Strategy, Strategy] {
  const terms = roundTerms(state.round)
  const post = postMoney(terms)
  const sitOut = ownAfter(state.ownershipBefore, terms, 0)
  return [
    { title: 'No follow-on', chequeCents: 0, ownership: sitOut, valueCents: stakeValue(sitOut, post) },
    { title: 'Your follow-on', chequeCents: state.investedCents, ownership: state.ownershipAfter, valueCents: state.stakeValueCents },
    {
      title: 'Maintain pro-rata',
      chequeCents: state.proRataCents,
      ownership: state.ownershipBefore,
      valueCents: stakeValue(state.ownershipBefore, post),
    },
  ]
}

export function RoundsPanel({
  rounds,
  states,
  dispatch,
}: {
  /** Follow-on rounds only — the entry (`rounds[0]`) has its own panel. */
  rounds: Round[]
  /** Every round's computed state, entry included, in date order. */
  states: RoundState[]
  dispatch: (action: Action) => void
}) {
  const { money } = useMoney()
  // Loaded rounds start as one-line summaries; the one you add, or choose to
  // edit, opens. Three open rounds made the page several screens long.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (id: string) =>
    setOpen((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const add = () => {
    const id = `r${Date.now().toString(36)}${rounds.length}`
    dispatch({ type: 'round:add', id })
    setOpen((was) => new Set(was).add(id))
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
      lede="Each time the company raises money it issues new shares, so your percentage falls unless you invest again. What that percentage is worth can still grow."
      aside={addRound}
    >
      {rounds.length === 0 ? (
        <div className="border border-dashed border-rule-strong px-5 py-8 text-center">
          <p className="text-sm text-ink-soft">
            No later rounds yet. Add a Series A to see how new money{' '}
            <span className="inline-flex items-center gap-1">
              dilutes you <InfoTip term="dilution" />
            </span>{' '}
            and what it would cost to keep your share.
          </p>
          <div className="mt-4 flex justify-center">{addRound}</div>
        </div>
      ) : (
        <>
          <AreaWealth
            points={states
              .filter((s) => s.ownershipAfter > 0)
              .map((s) => ({
                label: roundName(s.round),
                ownership: s.ownershipAfter,
                valuationCents: s.postMoneyCents,
                valueCents: s.stakeValueCents,
              }))}
          />
          <p className="mx-auto mt-2 max-w-prose text-center text-xs text-ink-faint">
            Width is your ownership, height is the company&rsquo;s valuation, so each area is the paper value of
            your stake.
          </p>
          <div className="mt-6">
            <DilutionTable states={states} />
          </div>
        </>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {rounds.map((round) => {
          const state = states.find((s) => s.round.id === round.id)
          const set = (patch: Partial<Round>) => dispatch({ type: 'round:set', id: round.id, patch })
          const participate = (patch: Partial<Instrument>) => dispatch({ type: 'round:participate', id: round.id, patch })
          const cheque = round.participation
          const name = roundName(round)
          const held = state !== undefined && state.ownershipBefore > 0
          const expanded = open.has(round.id)
          const bodyId = `round-${round.id}-details`

          return (
            <article key={round.id} aria-label={name} className="border border-rule bg-ground/40 p-4 sm:p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{name}</h3>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-ink-faint">
                    {money(round.raisedCents)} at {money(state?.postMoneyCents ?? round.valuationCents)} post-money · {round.date.slice(0, 4)}
                    {cheque ? ` · you invest ${money(cheque.amountCents)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {state ? (
                    <p className="font-mono text-xs tabular-nums text-ink-faint">
                      you own <span className="text-ink">{ownership(state.ownershipAfter)}</span>
                      {' · '}
                      <span className="text-gain">{money(state.stakeValueCents)}</span> paper value
                    </p>
                  ) : null}
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={bodyId}
                    aria-label={`Edit ${name}`}
                    onClick={() => toggle(round.id)}
                    className="border border-accent px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-accent outline-none transition-colors hover:bg-accent-wash focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    {expanded ? 'Done' : 'Edit'}
                  </button>
                  <Button tone="quiet" onClick={() => dispatch({ type: 'round:remove', id: round.id })} title={`Remove ${name}`}>
                    Remove
                  </Button>
                </div>
              </header>

              {held && state ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-accent/30 bg-accent-wash/50 px-4 py-3">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
                    <span>
                      Amount required to keep your {ownership(state.ownershipBefore)}:{' '}
                      <strong className="font-mono tabular-nums text-ink">{money(state.proRataCents)}</strong>
                    </span>
                    <InfoTip term="proRata" />
                  </p>
                  {cheque?.amountCents === state.proRataCents ? (
                    <span className="font-mono text-[11px] uppercase tracking-wider text-gain">Pro-rata selected</span>
                  ) : (
                    <Button
                      onClick={() =>
                        participate({
                          ...(cheque ?? { type: 'equity' as const, entryFee: NO_FEE }),
                          amountCents: state.proRataCents,
                        })
                      }
                    >
                      Invest pro-rata
                    </Button>
                  )}
                </div>
              ) : null}

              <div id={bodyId} hidden={!expanded}>
                {expanded ? (
                  <>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <SelectField
                        label="Round"
                        value={isPreset(round.label) ? round.label : CUSTOM}
                        options={LABEL_OPTIONS}
                        onChange={(label) => set({ label: label === CUSTOM ? 'Custom round' : label })}
                      />
                      {isPreset(round.label) ? null : (
                        <TextField label="Round name" value={round.label} onChange={(label) => set({ label: label.slice(0, 40) })} />
                      )}
                      <TextField label="Date" type="date" value={round.date} onChange={(date) => set({ date })} />
                      <MoneyField label="New capital raised" valueCents={round.raisedCents} onChange={(raisedCents) => set({ raisedCents })} />
                      <MoneyField
                        label="Company valuation"
                        info={round.valuationBasis === 'pre' ? 'preMoney' : 'postMoney'}
                        valueCents={round.valuationCents}
                        onChange={(valuationCents) => set({ valuationCents })}
                      />
                      <SwitchField label="Valuation basis" info="valuationBasis" value={round.valuationBasis} options={VALUATION_BASIS} onChange={(valuationBasis) => set({ valuationBasis })} />
                      <PercentField
                        label="New option pool"
                        info="optionPool"
                        value={round.newOptionPool ?? 0}
                        onChange={(newOptionPool) => set({ newOptionPool: newOptionPool || undefined })}
                        hint="Carved out of the pre-money, so you share the dilution."
                      />
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <SwitchField
                        label="Do you invest in this round?"
                        value={cheque ? 'yes' : 'no'}
                        options={PARTICIPATE}
                        onChange={(choice) =>
                          choice === 'no'
                            ? dispatch({ type: 'round:sitOut', id: round.id })
                            : participate(cheque ?? { type: 'equity', amountCents: 0, entryFee: NO_FEE })
                        }
                      />
                      {cheque ? (
                        <MoneyField
                          label="Your follow-on investment"
                          valueCents={cheque.amountCents}
                          onChange={(amountCents) => participate({ amountCents })}
                        />
                      ) : null}
                    </div>

                    {cheque ? (
                      <div className="mt-4">
                        <Disclosure summary="Instrument and fees for this cheque" defaultOpen={hasEntryFee(cheque)}>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <SelectField label="Instrument" value={cheque.type} options={TYPES} onChange={(type) => participate({ type })} hint={INSTRUMENT_NOTE} />
                          </div>
                          <div className="mt-4">
                            <EntryFeeFields fee={cheque.entryFee} onChange={(entryFee) => participate({ entryFee })} />
                          </div>
                        </Disclosure>
                      </div>
                    ) : null}

                    {held && state ? <FollowOnComparison round={round} state={state} /> : null}
                  </>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </Panel>
  )
}

function FollowOnComparison({ round, state }: { round: Round; state: RoundState }) {
  const { money } = useMoney()
  // It only mounts when a round is opened, so this counts people who looked.
  useEffect(() => trackOnce({ name: 'pro_rata_scenario_viewed' }), [])
  const options = strategies(state)
  const widest = Math.max(...options.map((o) => o.ownership), Number.EPSILON)

  return (
    <div className="mt-6 border-t border-rule pt-5">
      <h4 className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        Compare your options in {roundName(round)}
      </h4>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {options.map((option) => {
          const chosen = option.title === 'Your follow-on'
          return (
            <li key={option.title} className={`border p-3 ${chosen ? 'border-accent' : 'border-rule'}`}>
              <p className="flex items-center justify-between gap-2 text-sm font-medium text-ink">
                {option.title}
                {chosen ? <span className="font-mono text-[10px] uppercase tracking-wider text-accent">current</span> : null}
              </p>
              <div className="mt-3 h-1.5 bg-sunk" aria-hidden="true">
                <div className="h-full bg-accent" style={{ width: `${(option.ownership / widest) * 100}%` }} />
              </div>
              <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                {[
                  [option.title === 'Maintain pro-rata' ? 'Required investment' : 'Additional investment', money(option.chequeCents)],
                  ['Ownership after round', ownership(option.ownership)],
                  ['Paper value after round', money(option.valueCents)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-ink-faint">{label}</dt>
                    <dd className="font-mono tabular-nums text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
