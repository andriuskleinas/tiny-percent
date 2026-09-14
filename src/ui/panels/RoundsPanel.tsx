import { useMoney } from '../currency'
import { ownAfter, postMoney, proRata, stakeValue } from '../../engine/ownership'
import { roundTerms } from '../../engine/scenario'
import type { RoundState } from '../../engine/scenario'
import type { Instrument, Round, RoundLabel } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { AreaWealth } from '../charts/AreaWealth'
import type { AreaPoint } from '../charts/AreaWealth'
import { Button, MoneyField, Panel, PercentField, SelectField, SwitchField, TextField } from '../controls'
import { INSTRUMENT_NOTE, percent } from '../format'

const LABELS: ReadonlyArray<readonly [RoundLabel, string]> = [
  ['Pre-seed', 'Pre-seed'],
  ['Seed', 'Seed'],
  ['Series A', 'Series A'],
  ['Series B', 'Series B'],
  ['Series C', 'Series C'],
  ['Series D+', 'Series D+'],
]

const TYPES = [
  ['equity', 'Priced equity'],
  ['safe', 'SAFE'],
  ['cla', 'Convertible loan (CLA)'],
] as const

const VALUATION_BASIS = [
  ['pre', 'Pre-money'],
  ['post', 'Post-money'],
] as const

const PARTICIPATE = [
  ['no', 'No'],
  ['yes', 'Yes'],
] as const

const DEFAULT_ENTRY_FEE = { rule: 'percent' as const, percent: 0 }

function defaultInstrument(): Instrument {
  return { type: 'equity', amountCents: 0, entryFee: DEFAULT_ENTRY_FEE }
}

/** What ownership and stake would be if this round were sat out entirely. */
function sitOutView(round: Round, state: RoundState) {
  const terms = roundTerms(round)
  const ownership = ownAfter(state.ownershipBefore, terms, 0)
  return { ownership, stakeValueCents: stakeValue(ownership, postMoney(terms)) }
}

/** A pro-rata cheque holds ownership exactly level — that is what "pro-rata" means. */
function proRataView(round: Round, state: RoundState) {
  const terms = roundTerms(round)
  const chequeCents = proRata(state.ownershipBefore, terms)
  const stakeValueCents = stakeValue(state.ownershipBefore, postMoney(terms))
  return { ownership: state.ownershipBefore, stakeValueCents, chequeCents }
}

export function RoundsPanel({
  rounds,
  states,
  dispatch,
}: {
  /** Follow-on rounds only — the entry (`rounds[0]`) has its own panel. */
  rounds: Round[]
  /** Every round's computed state, entry included, for the chart at the top. */
  states: RoundState[]
  dispatch: (action: Action) => void
}) {
  const { money } = useMoney()
  return (
    <Panel
      title="The rounds"
      lede="Each round the company raises dilutes you unless you write a cheque. Your slice falls; watch what happens to what it is worth."
      aside={<Button onClick={() => dispatch({ type: 'round:add' })}>Add follow-on round</Button>}
    >
      <AreaWealth
        points={states
          .filter((s) => s.ownershipAfter > 0)
          .map((s) => ({
            label: s.round.label,
            ownership: s.ownershipAfter,
            valuationCents: s.postMoneyCents,
            valueCents: s.stakeValueCents,
          }))}
      />
      <p className="mx-auto mt-2 max-w-prose text-center text-xs text-ink-faint">
        Width is your ownership, height is the company&rsquo;s valuation. The area of each
        rectangle is what your stake is worth.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {rounds.map((round) => {
          const state = states.find((s) => s.round.id === round.id)
          const set = (patch: Partial<Round>) => dispatch({ type: 'round:set', id: round.id, patch })
          const participate = (patch: Partial<Instrument>) =>
            dispatch({ type: 'round:participate', id: round.id, patch })
          const participating = round.participation !== undefined

          const sitOut = state ? sitOutView(round, state) : undefined
          const proRataInfo = state ? proRataView(round, state) : undefined

          const points: AreaPoint[] =
            state && sitOut && proRataInfo
              ? [
                  { label: 'No follow-on', ownership: sitOut.ownership, valuationCents: state.postMoneyCents, valueCents: sitOut.stakeValueCents },
                  { label: 'Your amount', ownership: state.ownershipAfter, valuationCents: state.postMoneyCents, valueCents: state.stakeValueCents },
                  { label: 'Pro-rata', ownership: proRataInfo.ownership, valuationCents: state.postMoneyCents, valueCents: proRataInfo.stakeValueCents },
                ]
              : []

          return (
            <div key={round.id} className="border border-rule bg-ground/40 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ink">{round.label}</h3>
                <div className="flex items-center gap-3">
                  {state ? (
                    <p className="font-mono text-xs tabular-nums text-ink-faint">
                      <span className="text-dilute">{percent(state.ownershipAfter)}</span>
                      {' · '}
                      <span className="text-gain">{money(state.stakeValueCents)}</span>
                    </p>
                  ) : null}
                  <Button tone="quiet" onClick={() => dispatch({ type: 'round:remove', id: round.id })}>
                    Remove
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SelectField label="Round" value={round.label} options={LABELS} onChange={(label) => set({ label })} />
                <TextField label="Date" type="date" value={round.date} onChange={(date) => set({ date })} />
                <MoneyField label="Raising" valueCents={round.raisedCents} onChange={(raisedCents) => set({ raisedCents })} />
                <MoneyField label="Valuation" valueCents={round.valuationCents} onChange={(valuationCents) => set({ valuationCents })} />
                <SwitchField label="Valuation basis" value={round.valuationBasis} options={VALUATION_BASIS} onChange={(valuationBasis) => set({ valuationBasis })} />
                <PercentField
                  label="New option pool"
                  value={round.newOptionPool ?? 0}
                  onChange={(newOptionPool) => set({ newOptionPool: newOptionPool || undefined })}
                  hint="Carved out of the pre-money, so you pay for it."
                />
                <SwitchField
                  label="Do you participate in this round?"
                  value={participating ? 'yes' : 'no'}
                  options={PARTICIPATE}
                  onChange={(choice) =>
                    choice === 'no'
                      ? dispatch({ type: 'round:sitOut', id: round.id })
                      : dispatch({ type: 'round:participate', id: round.id, patch: round.participation ?? defaultInstrument() })
                  }
                />
              </div>

              {participating && round.participation ? (
                <div className="mt-4 grid gap-4 border-t border-rule pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  <SelectField label="Instrument" value={round.participation.type} options={TYPES} onChange={(type) => participate({ type })} hint={INSTRUMENT_NOTE} />
                  <MoneyField label="Your cheque" valueCents={round.participation.amountCents} onChange={(amountCents) => participate({ amountCents })}
                    hint={state ? `Pro-rata here is ${money(state.proRataCents)}.` : undefined} />
                  <SelectField
                    label="Entry fee basis"
                    value={round.participation.entryFee.rule}
                    options={[
                      ['percent', 'Percentage of the cheque'],
                      ['fixed', 'Fixed amount'],
                      ['greater_of', 'Greater of the two'],
                    ] as const}
                    onChange={(rule) => participate({ entryFee: { ...round.participation?.entryFee, rule } })}
                  />
                  {round.participation.entryFee.rule !== 'fixed' ? (
                    <PercentField
                      label="Entry fee percentage"
                      value={round.participation.entryFee.percent ?? 0}
                      onChange={(value) => participate({ entryFee: { ...round.participation?.entryFee, rule: round.participation?.entryFee.rule ?? 'percent', percent: value } })}
                    />
                  ) : null}
                  {round.participation.entryFee.rule !== 'percent' ? (
                    <MoneyField
                      label="Fixed entry fee"
                      valueCents={round.participation.entryFee.fixedCents ?? 0}
                      onChange={(fixedCents) => participate({ entryFee: { ...round.participation?.entryFee, rule: round.participation?.entryFee.rule ?? 'fixed', fixedCents } })}
                    />
                  ) : null}
                </div>
              ) : null}

              {state && points.length > 0 ? (
                <div className="mt-6 border-t border-rule pt-6">
                  <AreaWealth points={points} />
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    {[
                      { title: 'No follow-on', ownership: sitOut?.ownership ?? 0, stakeValueCents: sitOut?.stakeValueCents ?? 0, chequeCents: 0 },
                      { title: 'Your amount', ownership: state.ownershipAfter, stakeValueCents: state.stakeValueCents, chequeCents: state.investedCents },
                      { title: 'Pro-rata', ownership: proRataInfo?.ownership ?? 0, stakeValueCents: proRataInfo?.stakeValueCents ?? 0, chequeCents: proRataInfo?.chequeCents ?? 0 },
                    ].map(({ title, ownership, stakeValueCents, chequeCents }) => (
                      <div key={title} className="border border-rule p-3">
                        <h4 className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">{title}</h4>
                        <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                          {[
                            ['Cheque here', money(chequeCents)],
                            ['Stake after', percent(ownership, 3)],
                            ['Worth after', money(stakeValueCents)],
                          ].map(([label, value]) => (
                            <div key={label} className="flex justify-between gap-4">
                              <dt className="text-ink-faint">{label}</dt>
                              <dd className="font-mono tabular-nums text-ink">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                  <p className="mx-auto mt-3 max-w-prose text-center text-xs text-ink-faint">
                    No follow-on, your typed cheque, and the pro-rata cheque that would keep your
                    stake exactly level — side by side.
                  </p>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

