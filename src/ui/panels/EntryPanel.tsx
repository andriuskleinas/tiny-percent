import { useState } from 'react'
import { useMoney } from '../currency'
import type { RoundState } from '../../engine/scenario'
import type { Currency, Instrument, Round } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { ChoiceGroup, InfoTip, MoneyField, Panel, Stat, SwitchField, TextField } from '../controls'
import { ownership } from '../format'
import { entryIsComplete } from '../facts'
import { INVESTMENT_INPUT_ID } from '../../landing/scroll'

const CURRENCIES: readonly [readonly [Currency, string], readonly [Currency, string]] = [
  ['EUR', 'Euro'],
  ['USD', 'US dollar'],
]

const VALUATION_BASIS = [
  ['pre', 'Pre-money'],
  ['post', 'Post-money'],
] as const

/** The rounds an angel usually enters at, and a way out for anything else. */
const ENTRY_ROUNDS = ['Pre-seed', 'Seed', 'Series A'] as const
const OTHER = 'other'
const ROUND_CHOICES: ReadonlyArray<readonly [string, string]> = [...ENTRY_ROUNDS.map((r) => [r, r] as const), [OTHER, 'Other']]

export function EntryPanel({
  round,
  currency,
  state,
  dispatch,
}: {
  round: Round
  currency: Currency
  state: RoundState | undefined
  dispatch: (action: Action) => void
}) {
  const { money } = useMoney()
  const set = (patch: Partial<Round>) => dispatch({ type: 'round:set', id: round.id, patch })
  const participate = (patch: Partial<Instrument>) => dispatch({ type: 'round:participate', id: round.id, patch })
  const entry = round.participation
  const complete = entryIsComplete(round)
  const feeCents = state && entry ? state.entryFeeCents : 0
  const named = (ENTRY_ROUNDS as readonly string[]).includes(round.label)
  // Focus the name field only when "Other" was just clicked, never on page load.
  const [choseOther, setChoseOther] = useState(false)

  return (
    <Panel
      id="your-investment"
      title="Your initial investment"
      lede="Start with your cheque and the round you are investing in."
    >
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <p aria-hidden="true" className="text-[13px] font-medium text-ink-soft">
              Funding round
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ChoiceGroup
                label="Funding round"
                value={named ? round.label : OTHER}
                options={ROUND_CHOICES}
                onChange={(label) => {
                  setChoseOther(label === OTHER)
                  set({ label: label === OTHER ? (named ? '' : round.label) : label })
                }}
              />
              {named ? null : (
                <div className="min-w-[10rem] flex-1">
                  <TextField
                    label="Round name"
                    value={round.label}
                    placeholder="e.g. Angel round"
                    autoFocus={choseOther}
                    onChange={(label) => set({ label: label.slice(0, 40) })}
                  />
                </div>
              )}
            </div>
          </div>
          <MoneyField
            label="Investment amount"
            id={INVESTMENT_INPUT_ID}
            valueCents={entry?.amountCents ?? 0}
            onChange={(amountCents) => participate({ amountCents })}
            placeholder="e.g. 5,000"
          />
          <SwitchField
            label="Currency"
            value={currency}
            options={CURRENCIES}
            onChange={(next) => dispatch({ type: 'currency:set', currency: next })}
            info="currency"
          />
          <MoneyField
            label="Company valuation"
            info={round.valuationBasis === 'pre' ? 'preMoney' : 'postMoney'}
            valueCents={round.valuationCents}
            onChange={(valuationCents) => set({ valuationCents })}
            placeholder="e.g. 4m"
          />
          <SwitchField
            label="Valuation basis"
            info="valuationBasis"
            value={round.valuationBasis}
            options={VALUATION_BASIS}
            onChange={(valuationBasis) => set({ valuationBasis })}
          />
          <MoneyField
            label="Amount raised"
            valueCents={round.raisedCents}
            onChange={(raisedCents) => set({ raisedCents })}
            placeholder="e.g. 1m"
            hint="The whole round, your cheque included."
          />
          <TextField label="Investment date" type="date" value={round.date} onChange={(date) => set({ date })} />
        </div>

        <div aria-live="polite" className="self-start rounded-2xl border border-rule bg-sunk/60 p-5">
          {complete && state ? (
            <>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-ink-faint">Your ownership</p>
                <InfoTip term="postMoney" />
              </div>
              <p className="mt-1 font-mono text-4xl font-semibold tracking-tight tabular-nums text-ink">
                {ownership(state.ownershipAfter)}
              </p>
              <p className="mt-1 text-xs text-ink-faint">of the company, after this round</p>
              <div className="mt-4">
                <Stat label="Post-money valuation" value={money(state.postMoneyCents)} info="postMoney" />
                <Stat label="Paper value of your stake" value={money(state.stakeValueCents)} info="paperValue" tone="gain" />
                {feeCents > 0 ? <Stat label="Entry fee paid on top" value={money(feeCents)} /> : null}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-ink-faint">Your ownership</p>
              <p className="mt-1 font-mono text-4xl font-semibold tracking-tight text-ink-faint">—</p>
              <p className="mt-3 text-sm text-ink-soft">
                Enter your investment amount and the company&rsquo;s valuation to see what you own.
              </p>
            </>
          )}
        </div>
      </div>
    </Panel>
  )
}
