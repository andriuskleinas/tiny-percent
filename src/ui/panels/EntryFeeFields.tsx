import type { EntryFeeTerms } from '../../engine/fees'
import { MoneyField, PercentField, SelectField } from '../controls'

const RULES = [
  ['percent', 'Percentage of the cheque'],
  ['fixed', 'Fixed amount'],
  ['greater_of', 'Greater of the two'],
] as const

/**
 * The entry fee on one cheque, shared by the entry and every follow-on. Each
 * field patches only its own term, so editing the percentage can never discard
 * a fixed minimum — the bug the fee render tests guard against.
 */
export function EntryFeeFields({ fee, onChange }: { fee: EntryFeeTerms; onChange: (fee: EntryFeeTerms) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label="Entry fee basis"
        value={fee.rule}
        options={RULES}
        onChange={(rule) => onChange({ ...fee, rule })}
        hint="Only if you invest through a syndicate or SPV that charges one."
      />
      {fee.rule !== 'fixed' ? (
        <PercentField
          label="Entry fee percentage"
          info="entryFee"
          value={fee.percent ?? 0}
          onChange={(percent) => onChange({ ...fee, percent })}
        />
      ) : null}
      {fee.rule !== 'percent' ? (
        <MoneyField
          label="Fixed entry fee"
          valueCents={fee.fixedCents ?? 0}
          onChange={(fixedCents) => onChange({ ...fee, fixedCents })}
          hint={fee.rule === 'greater_of' ? 'Charged instead when it is larger.' : undefined}
        />
      ) : null}
    </div>
  )
}
