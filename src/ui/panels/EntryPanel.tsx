import { useState } from 'react'
import { useMoney } from '../currency'
import { isConvertible } from '../../engine/convert'
import { stakeValue } from '../../engine/ownership'
import type { EntryStatus, RoundState } from '../../engine/scenario'
import type { Currency, Instrument, InstrumentType, InterestMode, Round } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { ChoiceGroup, InfoTip, MoneyField, Panel, PercentField, Stat, SwitchField, TextField } from '../controls'
import { conversionRoute, instrumentName, ownership, roundName } from '../format'
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

const INSTRUMENTS: ReadonlyArray<readonly [InstrumentType, string]> = [
  ['equity', 'Shares'],
  ['safe', 'SAFE'],
  ['cla', 'Convertible note'],
]

const INTEREST_MODES: readonly [readonly [InterestMode, string], readonly [InterestMode, string]] = [
  ['simple', 'Simple'],
  ['compound', 'Compounding'],
]

/** The rounds an angel usually enters at, and a way out for anything else. */
const ENTRY_ROUNDS = ['Pre-seed', 'Seed', 'Series A'] as const
const OTHER = 'other'
const ROUND_CHOICES: ReadonlyArray<readonly [string, string]> = [...ENTRY_ROUNDS.map((r) => [r, r] as const), [OTHER, 'Other']]

export function EntryPanel({
  round,
  currency,
  state,
  status,
  converted,
  dispatch,
}: {
  round: Round
  currency: Currency
  state: RoundState | undefined
  /** How the entry cheque stands. Undefined while the scenario cannot run. */
  status?: EntryStatus | undefined
  /** The round a SAFE or note entry converts in, once there is one. */
  converted?: RoundState | undefined
  dispatch: (action: Action) => void
}) {
  const { money } = useMoney()
  const set = (patch: Partial<Round>) => dispatch({ type: 'round:set', id: round.id, patch })
  const participate = (patch: Partial<Instrument>) => dispatch({ type: 'round:participate', id: round.id, patch })
  const entry = round.participation
  const type = entry?.type ?? 'equity'
  const convertible = isConvertible(type)
  const what = instrumentName(type)
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
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <div className="flex items-center gap-1.5">
              <p aria-hidden="true" className="text-[13px] font-medium text-ink-soft">
                What you are buying
              </p>
              <InfoTip term="instrument" />
            </div>
            <ChoiceGroup label="What you are buying" value={type} options={INSTRUMENTS} onChange={(next) => participate({ type: next })} />
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
            label={convertible ? 'Valuation cap' : 'Company valuation'}
            info={convertible ? 'valuationCap' : round.valuationBasis === 'pre' ? 'preMoney' : 'postMoney'}
            valueCents={round.valuationCents}
            onChange={(valuationCents) => set({ valuationCents })}
            placeholder={convertible ? 'e.g. 5m' : 'e.g. 4m'}
          />
          <SwitchField
            label={convertible ? 'Cap basis' : 'Valuation basis'}
            info={convertible ? 'valuationCap' : 'valuationBasis'}
            value={round.valuationBasis}
            options={VALUATION_BASIS}
            onChange={(valuationBasis) => set({ valuationBasis })}
          />
          <MoneyField
            label={convertible ? `Raised on these ${what} terms` : 'Amount raised'}
            valueCents={round.raisedCents}
            onChange={(raisedCents) => set({ raisedCents })}
            placeholder="e.g. 1m"
            hint={
              convertible
                ? 'Everyone investing on these terms, you included. It only changes the answer for a pre-money cap.'
                : 'The whole round, your cheque included.'
            }
          />
          <TextField label="Investment date" type="date" value={round.date} onChange={(date) => set({ date })} />
          {convertible ? (
            <PercentField
              label="Discount"
              info="discount"
              value={entry?.discount ?? 0}
              max={99}
              onChange={(discount) => participate({ discount })}
              hint="Off the next round’s price. Leave at 0 if there is none."
            />
          ) : null}
          {type === 'cla' ? (
            <>
              <PercentField
                label="Interest rate a year"
                info="interest"
                value={entry?.interestRate ?? 0}
                onChange={(interestRate) => participate({ interestRate })}
              />
              <SwitchField
                label="Interest"
                value={entry?.interestMode ?? 'simple'}
                options={INTEREST_MODES}
                onChange={(interestMode) => participate({ interestMode })}
              />
            </>
          ) : null}
        </div>

        <div aria-live="polite" className="self-start rounded-2xl border border-rule bg-sunk/60 p-5">
          {complete && state ? (
            <>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-ink-faint">{convertible ? 'Your ownership at the cap' : 'Your ownership'}</p>
                <InfoTip term={convertible ? 'valuationCap' : 'postMoney'} />
              </div>
              <p className="mt-1 font-mono text-4xl font-semibold tracking-tight tabular-nums text-ink">
                {ownership(state.ownershipAfter)}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                {convertible ? 'of the company, if your ' + what + ' converts at the cap' : 'of the company, after this round'}
              </p>
              {convertible ? <ConversionNote what={what} cheque={entry} status={status} converted={converted} /> : null}
              <div className="mt-4">
                {convertible ? (
                  <Stat
                    label={round.valuationBasis === 'pre' ? 'Cap plus everything converting' : 'Valuation cap'}
                    value={money(state.postMoneyCents)}
                    info="valuationCap"
                  />
                ) : (
                  <Stat label="Post-money valuation" value={money(state.postMoneyCents)} info="postMoney" />
                )}
                <Stat label="Paper value of your stake" value={money(state.stakeValueCents)} info="paperValue" tone="gain" />
                {feeCents > 0 ? <Stat label="Entry fee paid on top" value={money(feeCents)} /> : null}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-ink-faint">Your ownership</p>
              <p className="mt-1 font-mono text-4xl font-semibold tracking-tight text-ink-faint">—</p>
              <p className="mt-3 text-sm text-ink-soft">
                {convertible
                  ? 'Enter your investment amount and the valuation cap to see what you own.'
                  : 'Enter your investment amount and the company’s valuation to see what you own.'}
              </p>
            </>
          )}
        </div>
      </div>
    </Panel>
  )
}

/**
 * What happens to a SAFE or note: where it converted and at which price, or
 * that it has not converted yet. Every percentage sits beside its value.
 */
function ConversionNote({
  what,
  cheque,
  status,
  converted,
}: {
  what: string
  cheque: Instrument | undefined
  status: EntryStatus | undefined
  converted: RoundState | undefined
}) {
  const { money } = useMoney()
  const conversion = converted?.conversion
  return (
    <div className="mt-3 flex flex-col gap-2 text-xs text-ink-soft">
      {conversion && converted ? (
        <p>
          <span className="font-medium text-ink">
            Converts in {roundName(converted.round)} at {conversionRoute(conversion.route, cheque?.discount)}:
          </span>{' '}
          {ownership(conversion.ownership)} once that round closes, worth {money(stakeValue(conversion.ownership, converted.postMoneyCents))}.
          {conversion.accruedCents > 0
            ? ` That includes ${money(conversion.accruedCents)} of interest, which converts but is not money you paid.`
            : ''}
        </p>
      ) : status?.kind === 'pending' ? (
        <p>
          <span className="font-medium text-ink">Not converted yet.</span> This is your stake at the cap. A priced round
          below the cap, or a discount, would give you more. Add the next round below to see your {what} convert.
        </p>
      ) : null}
      {status?.estimate ? (
        <p>
          <span className="font-medium text-ink">Estimate.</span> A pre-money cap also depends on the other SAFEs converting
          with yours, which the amount raised on these terms stands in for.
        </p>
      ) : null}
    </div>
  )
}
