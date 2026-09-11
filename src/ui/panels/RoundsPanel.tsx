import type { RoundState } from '../../engine/scenario'
import type { Round } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { AreaWealth } from '../charts/AreaWealth'
import { Button, MoneyField, Panel, PercentField, SelectField, TextField } from '../controls'
import { money, percent } from '../format'

const ACTIONS = [
  ['sit_out', 'Sit out'],
  ['pro_rata', 'Follow pro-rata'],
  ['custom', 'Custom amount'],
] as const

export function RoundsPanel({
  rounds,
  states,
  dispatch,
}: {
  rounds: Round[]
  states: RoundState[]
  dispatch: (action: Action) => void
}) {
  return (
    <Panel
      title="The rounds"
      lede="Each round the company raises dilutes you unless you write a cheque. Your slice falls; watch what happens to what it is worth."
      aside={<Button onClick={() => dispatch({ type: 'round:add' })}>Add round</Button>}
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

      <div className="mt-8 flex flex-col gap-4">
        {rounds.map((round, i) => {
          const state = states.find((s) => s.round.id === round.id)
          const set = (patch: Partial<Round>) => dispatch({ type: 'round:set', id: round.id, patch })
          const action = round.angelAction
          const isEntry = state?.conversion !== undefined

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
                  {rounds.length > 1 ? (
                    <Button tone="quiet" onClick={() => dispatch({ type: 'round:remove', id: round.id })}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <TextField label="Name" value={round.label} onChange={(label) => set({ label })} />
                <TextField label="Date" type="date" value={round.date} onChange={(date) => set({ date })} />
                <MoneyField label="Pre-money" valueCents={round.preMoneyCents} onChange={(preMoneyCents) => set({ preMoneyCents })} />
                <MoneyField label="Raising" valueCents={round.raisedCents} onChange={(raisedCents) => set({ raisedCents })} />
                <PercentField
                  label="New option pool"
                  value={round.newOptionPool ?? 0}
                  onChange={(newOptionPool) => set({ newOptionPool: newOptionPool || undefined })}
                  hint="Carved out of the pre-money, so you pay for it."
                />
                {isEntry ? (
                  <div className="flex flex-col justify-end">
                    <p className="text-xs text-ink-faint">
                      Your {i === 0 ? 'entry' : 'instrument'} lands here.
                    </p>
                  </div>
                ) : (
                  <>
                    <SelectField
                      label="What you do"
                      value={action.kind}
                      options={ACTIONS}
                      onChange={(kind) =>
                        set({
                          angelAction:
                            kind === 'custom'
                              ? { kind: 'custom', amountCents: state?.proRataCents ?? 0 }
                              : { kind },
                        })
                      }
                    />
                    {action.kind === 'custom' ? (
                      <MoneyField
                        label="Your cheque"
                        valueCents={action.amountCents}
                        onChange={(amountCents) => set({ angelAction: { kind: 'custom', amountCents } })}
                        hint={state ? `Pro-rata here is ${money(state.proRataCents)}.` : undefined}
                      />
                    ) : null}
                  </>
                )}
              </div>

              {!isEntry && state && state.proRataCents > 0 ? (
                <p className="mt-3 text-xs text-ink-faint">
                  Holding your position through this round costs{' '}
                  <span className="font-mono text-ink-soft">{money(state.proRataCents)}</span>
                  {round.newOptionPool ? ', including your share of the new option pool' : ''}.
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
