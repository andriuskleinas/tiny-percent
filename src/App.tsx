import { convert } from './engine/instrument'
import type { ConvertibleInput } from './engine/instrument'
import type { RoundTerms } from './engine/ownership'
import { toCents } from './engine/money'
import { money, percent } from './ui/format'

/**
 * Placeholder shell. The five real screens land in phase 04. This runs the same
 * cheque through every instrument, using the actual engine, so the scaffold
 * shows something true rather than a hardcoded table.
 */

const round: RoundTerms = { preMoney: toCents(8_000_000), raised: toCents(2_000_000) }
const cheque = toCents(50_000)
const cap = toCents(5_000_000)

const instruments: Array<[string, ConvertibleInput]> = [
  ['Priced equity', { type: 'equity', amountCents: cheque }],
  ['SAFE, post-money cap', { type: 'safe_post', amountCents: cheque, capCents: cap }],
  ['SAFE, pre-money cap', { type: 'safe_pre', amountCents: cheque, capCents: cap }],
  [
    'Convertible loan, 8% over 2y',
    {
      type: 'cla',
      amountCents: cheque,
      capCents: cap,
      discount: 0.2,
      interestRate: 0.08,
      interestMode: 'simple',
      years: 2,
    },
  ],
]

const results = instruments.map(([label, input]) => [label, convert(input, round)] as const)

export default function App() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        Phase 02 · instruments
      </p>
      <h1 className="mt-5 text-4xl font-medium tracking-tight text-ink">
        Angel Dilution Calculator
      </h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        The same $50,000 cheque into the same $2M round at $8M pre-money, written on four
        different instruments. What you sign matters as much as what you pay.
      </p>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule-strong text-left">
              {['Instrument', 'Converts', 'Priced at', 'Stake', 'Route'].map((h, i) => (
                <th
                  key={h}
                  className={`py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint ${i === 0 ? 'pr-4' : 'px-4 text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map(([label, r]) => (
              <tr key={label} className="border-b border-rule">
                <td className="py-3 pr-4 text-ink">
                  {label}
                  {r.estimate ? ' ' : null}
                  {r.estimate ? (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-dilute">
                      estimate
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-soft">
                  {money(r.convertingCents)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-soft">
                  {money(r.effectiveValuationCents)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-gain">
                  {percent(r.ownership, 3)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                  {r.route.replace('_', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 max-w-prose text-sm text-ink-soft">
        Every row cost the same $50,000. The loan converts more than was paid because
        interest accrued, but the return is still measured against the $50,000. A pre-money
        cap is worse than the same number as a post-money cap, and worse again once other
        instruments convert beside it.
      </p>

      <dl className="mt-10 border-t border-rule">
        {[
          ['Golden cases green', '8 of 11'],
          ['Next phase', '03 — exit and fees'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-rule py-3">
            <dt className="text-sm text-ink-faint">{label}</dt>
            <dd className="font-mono text-sm text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </main>
  )
}
