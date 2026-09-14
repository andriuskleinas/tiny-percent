import { useMoney } from '../currency'
import type { RoundState } from '../../engine/scenario'
import type { Currency, Instrument, InstrumentType, Round } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { Disclosure, InfoTip, MoneyField, Panel, PercentField, SelectField, Stat, SwitchField, TextField } from '../controls'
import { INSTRUMENT_NOTE, ownership } from '../format'
import { entryIsComplete, hasEntryFee } from '../facts'
import { EntryFeeFields } from './EntryFeeFields'
import { INVESTMENT_INPUT_ID } from '../../landing/scroll'

const TYPES: ReadonlyArray<readonly [InstrumentType, string]> = [
  ['equity', 'Priced equity'],
  ['safe', 'SAFE'],
  ['cla', 'Convertible loan (CLA)'],
]

const CURRENCIES: readonly [readonly [Currency, string], readonly [Currency, string]] = [
  ['EUR', 'Euro'],
  ['USD', 'US dollar'],
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
  const complete = entryIsComplete(round)
  const feeCents = state && entry ? state.entryFeeCents : 0

  return (
    <Panel
      id="your-investment"
      title="Your initial investment"
      lede="Start with your cheque and the round you are investing in."
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="grid content-start gap-4 sm:grid-cols-2">
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
            hint="Used for every amount, including later rounds and the exit."
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
            label="Amount the company is raising"
            valueCents={round.raisedCents}
            onChange={(raisedCents) => set({ raisedCents })}
            placeholder="e.g. 1m"
            hint="The whole round, your cheque included."
          />
          <TextField label="Investment date" type="date" value={round.date} onChange={(date) => set({ date })} />

          <div className="sm:col-span-2">
            <Disclosure summary="More terms: instrument, option pool, fees" defaultOpen={hasEntryFee(entry) || (round.newOptionPool ?? 0) > 0}>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Instrument"
                  value={entry?.type ?? 'equity'}
                  options={TYPES}
                  onChange={(type) => participate({ type })}
                  hint={INSTRUMENT_NOTE}
                />
                <PercentField
                  label="New option pool"
                  info="optionPool"
                  value={round.newOptionPool ?? 0}
                  onChange={(newOptionPool) => set({ newOptionPool: newOptionPool || undefined })}
                  hint="Created in this round, as a share of post-money."
                />
              </div>
              {entry ? (
                <div className="mt-6">
                  <EntryFeeFields fee={entry.entryFee} onChange={(entryFee) => participate({ entryFee })} />
                </div>
              ) : null}
            </Disclosure>
          </div>
        </div>

        <div aria-live="polite" className="self-start border border-rule bg-sunk/60 p-5">
          {complete && state ? (
            <>
              <div className="flex items-center gap-1.5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Your ownership</p>
                <InfoTip term="postMoney" />
              </div>
              <p className="mt-1 font-mono text-4xl font-semibold tracking-tight tabular-nums text-ink">
                {ownership(state.ownershipAfter)}
              </p>
              <p className="mt-1 text-xs text-ink-faint">of the company, after this round</p>
              <div className="mt-4">
                <Stat label="Investment amount" value={money(state.investedCents)} />
                <Stat
                  label="Total amount paid"
                  value={money(state.investedCents + feeCents)}
                  sub={feeCents > 0 ? `including a ${money(feeCents)} entry fee` : 'no fees'}
                />
                <Stat label="Post-money valuation" value={money(state.postMoneyCents)} info="postMoney" />
                <Stat label="Paper value of your stake" value={money(state.stakeValueCents)} info="paperValue" tone="gain" />
              </div>
            </>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Your ownership</p>
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
