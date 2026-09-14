import { useMoney } from '../currency'
import type { RoundState } from '../../engine/scenario'
import type { Currency, Instrument, InstrumentType, Round } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { MoneyField, Panel, PercentField, SelectField, Stat, SwitchField, TextField } from '../controls'
import { INSTRUMENT_NOTE, percent } from '../format'

const TYPES: ReadonlyArray<readonly [InstrumentType, string]> = [
  ['equity', 'Priced equity'],
  ['safe', 'SAFE'],
  ['cla', 'Convertible loan (CLA)'],
]

const CURRENCIES: readonly [readonly [Currency, string], readonly [Currency, string]] = [
  ['USD', 'US dollar'],
  ['EUR', 'Euro'],
]

const VALUATION_BASIS = [
  ['pre', 'Pre-money'],
  ['post', 'Post-money'],
] as const

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

  return (
    <Panel
      title="Your investment"
      lede="What you put in, on what paper, and what the startup itself is worth right now."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Instrument"
          value={entry?.type ?? 'equity'}
          hint={INSTRUMENT_NOTE}
          options={TYPES}
          onChange={(type) => participate({ type })}
        />
        <MoneyField
          label="Amount invested"
          valueCents={entry?.amountCents ?? 0}
          onChange={(amountCents) => participate({ amountCents })}
        />
        <SwitchField
          label="Currency"
          value={currency}
          options={CURRENCIES}
          onChange={(next) => dispatch({ type: 'currency:set', currency: next })}
          hint="Used for every amount in the deal, including later rounds and the exit."
        />
        <TextField label="Date" type="date" value={round.date} onChange={(date) => set({ date })} />
        <MoneyField
          label="Startup raising"
          valueCents={round.raisedCents}
          onChange={(raisedCents) => set({ raisedCents })}
        />
        <MoneyField
          label="Startup valuation"
          valueCents={round.valuationCents}
          onChange={(valuationCents) => set({ valuationCents })}
        />
        <SwitchField
          label="Valuation basis"
          value={round.valuationBasis}
          options={VALUATION_BASIS}
          onChange={(valuationBasis) => set({ valuationBasis })}
        />
      </div>

      <h3 className="mt-8 font-mono text-[10px] uppercase tracking-wider text-ink-faint">Entry fee</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Entry fee basis"
          value={entry?.entryFee.rule ?? 'percent'}
          options={[
            ['percent', 'Percentage of the cheque'],
            ['fixed', 'Fixed amount'],
            ['greater_of', 'Greater of the two'],
          ] as const}
          onChange={(rule) => participate({ entryFee: { ...entry?.entryFee, rule } })}
        />
        {entry?.entryFee.rule !== 'fixed' ? (
          <PercentField
            label="Entry fee percentage"
            value={entry?.entryFee.percent ?? 0}
            onChange={(value) => participate({ entryFee: { ...entry?.entryFee, rule: entry?.entryFee.rule ?? 'percent', percent: value } })}
          />
        ) : null}
        {entry?.entryFee.rule !== 'percent' ? (
          <MoneyField
            label="Fixed entry fee"
            valueCents={entry?.entryFee.fixedCents ?? 0}
            onChange={(fixedCents) => participate({ entryFee: { ...entry?.entryFee, rule: entry?.entryFee.rule ?? 'fixed', fixedCents } })}
            hint={entry?.entryFee.rule === 'greater_of' ? 'Charged instead when it is larger.' : undefined}
          />
        ) : null}
      </div>

      {state ? (
        <div className="mt-6 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Your stake" value={percent(state.ownershipAfter, 3)} tone="dilute" />
          <Stat label="Worth" value={money(state.stakeValueCents)} tone="gain" />
          <Stat label="You paid" value={money(state.investedCents)} tone="ink" />
        </div>
      ) : null}
    </Panel>
  )
}
