import { ownAfter, postMoney, proRata, stakeValue } from './engine/ownership'
import type { RoundTerms } from './engine/ownership'
import { toCents } from './engine/money'
import { money, percent } from './ui/format'

/**
 * Placeholder shell. The five real screens land in phase 04. This runs the
 * worked example from the plan through the actual engine, so the scaffold shows
 * something true rather than a hardcoded table.
 */

const seed: RoundTerms = { preMoney: toCents(8_000_000), raised: toCents(2_000_000) }
const seriesB: RoundTerms = { preMoney: toCents(24_000_000), raised: toCents(6_000_000) }
const seriesBPooled: RoundTerms = { ...seriesB, newOptionPool: 0.1 }

const entry = toCents(50_000) / postMoney(seed)
const sittingOut = ownAfter(entry, seriesB)
const pooled = ownAfter(entry, seriesBPooled)

const rows = [
  ['Entry', entry, stakeValue(entry, postMoney(seed)), null],
  ['Series B, sitting out', sittingOut, stakeValue(sittingOut, postMoney(seriesB)), proRata(entry, seriesB)],
  ['Series B with a 10% pool', pooled, stakeValue(pooled, postMoney(seriesBPooled)), proRata(entry, seriesBPooled)],
] as const

export default function App() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        Phase 01 · ownership engine
      </p>
      <h1 className="mt-5 text-4xl font-medium tracking-tight text-ink">
        Angel Dilution Calculator
      </h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        A $50,000 cheque into a $2M round at $8M pre-money, then a $6M Series B at $24M
        pre-money. Computed live by the engine, not typed in.
      </p>

      <table className="mt-10 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule-strong text-left">
            <th className="py-2 pr-4 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Round
            </th>
            <th className="py-2 pr-4 text-right font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Stake
            </th>
            <th className="py-2 pr-4 text-right font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              Worth
            </th>
            <th className="py-2 text-right font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              To hold it
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, own, worth, cheque]) => (
            <tr key={label} className="border-b border-rule">
              <td className="py-3 pr-4 text-ink">{label}</td>
              <td className="py-3 pr-4 text-right font-mono tabular-nums text-dilute">
                {percent(own)}
              </td>
              <td className="py-3 pr-4 text-right font-mono tabular-nums text-gain">
                {money(worth)}
              </td>
              <td className="py-3 text-right font-mono tabular-nums text-ink-soft">
                {cheque === null ? '—' : money(cheque)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6 text-sm text-ink-soft">
        Your slice falls while the stake grows. The option pool costs you half as much
        again to hold the same position.
      </p>

      <dl className="mt-10 border-t border-rule">
        {[
          ['Golden cases green', '4 of 11'],
          ['Next phase', '02 — instruments'],
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
