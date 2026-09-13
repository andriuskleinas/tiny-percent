import { useMoney } from '../currency'
import { accruesInterest, defaultCapBasis, instrumentPath } from '../../engine/instrument'
import type { Conversion } from '../../engine/instrument'
import type { Currency, Instrument, InstrumentType } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { MoneyField, Panel, PercentField, SelectField, Stat, TextField } from '../controls'
import { percent } from '../format'

// Plain names, no symbols: the option text is part of the page.
const CURRENCIES: ReadonlyArray<readonly [Currency, string]> = [
  ['USD', 'US dollar'],
  ['EUR', 'Euro'],
  ['GBP', 'Pound sterling'],
]

const TYPES: ReadonlyArray<readonly [InstrumentType, string]> = [
  ['equity', 'Priced equity'],
  ['safe_post', 'SAFE — post-money cap'],
  ['safe_pre', 'SAFE — pre-money cap'],
  ['cla', 'Convertible loan (CLA)'],
  ['asa', 'ASA (UK, SEIS/EIS)'],
  ['kiss_equity', 'KISS — equity'],
  ['kiss_debt', 'KISS — debt'],
]

/** Which fields this instrument actually needs. Everything else stays hidden. */
function fieldsFor(type: InstrumentType) {
  const priced = instrumentPath(type) === 'priced'
  return {
    cap: !priced,
    discount: !priced,
    interest: accruesInterest(type),
    otherConverting: !priced && defaultCapBasis(type) === 'pre',
  }
}

export function EntryPanel({
  entry,
  currency,
  conversion,
  stakeValueCents,
  dispatch,
}: {
  entry: Instrument
  currency: Currency
  conversion: Conversion | undefined
  /** What the stake was worth the moment it was bought. */
  stakeValueCents: number
  dispatch: (action: Action) => void
}) {
  const { money } = useMoney()
  const show = fieldsFor(entry.type)
  const set = (patch: Partial<Instrument>) => dispatch({ type: 'entry:set', patch })

  return (
    <Panel
      title="Your investment"
      lede="What you put in, and on what paper. The fields change with the instrument, because a SAFE and a priced round need different things from you."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Instrument"
          value={entry.type}
          options={TYPES}
          onChange={(type) => set({ type })}
        />
        <MoneyField label="Amount" valueCents={entry.amountCents} onChange={(amountCents) => set({ amountCents })} />
        <SelectField
          label="Currency"
          value={currency}
          options={CURRENCIES}
          onChange={(next) => dispatch({ type: 'currency:set', currency: next })}
        />
        <TextField label="Date" type="date" value={entry.date} onChange={(date) => set({ date })} />

        {show.cap ? (
          <MoneyField
            label={`Valuation cap (${defaultCapBasis(entry.type)}-money)`}
            valueCents={entry.capCents ?? 0}
            onChange={(capCents) => set({ capCents: capCents || undefined })}
            hint="Leave at zero for no cap."
          />
        ) : null}
        {show.discount ? (
          <PercentField
            label="Discount"
            value={entry.discount ?? 0}
            onChange={(discount) => set({ discount: discount || undefined })}
            hint="You get the cap or the discount, never both."
          />
        ) : null}
        {show.interest ? (
          <>
            <PercentField
              label="Interest rate"
              value={entry.interestRate ?? 0}
              onChange={(interestRate) => set({ interestRate: interestRate || undefined })}
            />
            <SelectField
              label="Interest basis"
              value={entry.interestMode ?? 'simple'}
              options={[
                ['simple', 'Simple'],
                ['compound', 'Compounding'],
              ] as const}
              onChange={(interestMode) => set({ interestMode })}
            />
          </>
        ) : null}
        {show.otherConverting ? (
          <MoneyField
            label="Other instruments converting"
            valueCents={entry.otherConvertingCents ?? 0}
            onChange={(otherConvertingCents) => set({ otherConvertingCents: otherConvertingCents || undefined })}
            hint="A pre-money cap is diluted by everything converting beside it."
          />
        ) : null}
      </div>

      {conversion ? (
        <div className="mt-6 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Converts" value={money(conversion.convertingCents)} tone="soft"
            sub={conversion.accruedCents > 0 ? `${money(conversion.accruedCents)} of it accrued interest` : 'No interest accrued'} />
          <Stat label="Priced at" value={money(conversion.effectiveValuationCents)} tone="soft"
            sub={`via the ${conversion.route.replace('_', ' ')}`} />
          <Stat label="Stake bought" value={`${percent(conversion.ownership, 3)} · ${money(stakeValueCents)}`} tone="gain"
            sub={conversion.route === 'cap' ? `${percent(conversion.ownershipAtConversion, 3)} before the new money` : 'worth, at that round'} />
          <Stat label="You paid" value={money(conversion.investedCents)} tone="ink"
            sub={conversion.estimate ? 'Estimate — other converters are invisible' : undefined} />
        </div>
      ) : (
        <p className="mt-6 border-t border-rule pt-4 text-sm text-dilute">
          This loan is not being converted, so it stays debt and is repaid ahead of every
          shareholder. Change the maturity choice on the exit to convert it instead.
        </p>
      )}
    </Panel>
  )
}
