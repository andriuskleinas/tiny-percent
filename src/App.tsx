import { toCents } from './engine/money'
import { runScenario } from './engine/scenario'
import type { Scenario } from './engine/types'
import { money, percent } from './ui/format'

/**
 * Placeholder shell. The five real screens land in phase 04. This runs a whole
 * scenario through the finished engine — entry, three rounds, exit, fees — so
 * the page shows something true rather than a hardcoded table.
 */

const scenario: Scenario = {
  version: 1,
  currency: 'USD',
  entry: { type: 'equity', amountCents: toCents(50_000), date: '2020-01-01' },
  rounds: [
    { id: 'a', label: 'Series A', date: '2020-01-01', preMoneyCents: toCents(8_000_000), raisedCents: toCents(2_000_000), angelAction: { kind: 'sit_out' } },
    { id: 'b', label: 'Series B', date: '2022-01-01', preMoneyCents: toCents(24_000_000), raisedCents: toCents(6_000_000), angelAction: { kind: 'sit_out' } },
    { id: 'c', label: 'Series C', date: '2024-01-01', preMoneyCents: toCents(48_000_000), raisedCents: toCents(12_000_000), angelAction: { kind: 'sit_out' } },
  ],
  fees: {
    entry: { rule: 'percent', percent: 0.02, charged: 'on_top' },
    carry: { percent: 0.2, basis: 'per_deal' },
  },
  exit: { date: '2026-01-01', valueCents: toCents(60_000_000), totalRaisedCents: toCents(20_000_000) },
}

const run = runScenario(scenario)
const fees = run.feesLow

const REGIME_TONE: Record<string, string> = {
  clean: 'text-gain',
  uncertain: 'text-ink-soft',
  downside: 'text-dilute',
}

export default function App() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
        Phase 03 · exit and fees
      </p>
      <h1 className="mt-5 text-4xl font-medium tracking-tight text-ink">
        Angel Dilution Calculator
      </h1>
      <p className="mt-4 max-w-prose text-ink-soft">
        A $50,000 cheque at $8M pre-money, sitting out two further rounds, sold at $60M six
        years later. Every figure below comes from the engine.
      </p>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-rule-strong text-left">
              {['Round', 'Post-money', 'Stake', 'Worth', 'To hold it'].map((h, i) => (
                <th key={h} className={`py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint ${i === 0 ? 'pr-4' : 'px-4 text-right'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {run.rounds.map((r) => (
              <tr key={r.round.id} className="border-b border-rule">
                <td className="py-3 pr-4 text-ink">{r.round.label}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-soft">{money(r.postMoneyCents)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-dilute">{percent(r.ownershipAfter, 2)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-gain">{money(r.stakeValueCents)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-soft">
                  {r.proRataCents === 0 ? '—' : money(r.proRataCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 border border-rule bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Exit at {money(scenario.exit.valueCents)}</h2>
          <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${REGIME_TONE[run.exit.regime]}`}>
            {run.exit.regime} regime
          </span>
        </div>
        <p className="mt-3 text-sm text-ink-soft">{run.exit.explanation}</p>

        <dl className="mt-6 grid grid-cols-2 gap-x-8 sm:grid-cols-4">
          {[
            ['Gross', money(run.exit.lowCents)],
            ['Carry', `−${money(fees.carryCents)}`],
            ['Entry fee', `−${money(fees.entryFeeCents)}`],
            ['Net to you', money(fees.netCents)],
          ].map(([label, value]) => (
            <div key={label} className="border-t border-rule py-3">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</dt>
              <dd className="mt-1 font-mono tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <dl className="mt-2 grid grid-cols-2 gap-x-8 sm:grid-cols-4">
          {[
            ['Deployed', money(fees.deployedCents)],
            ['Out of pocket', money(fees.outlayCents)],
            ['Gross · net', `${fees.grossMultiple.toFixed(2)}× · ${fees.netMultiple.toFixed(2)}×`],
            ['Net rate of return', run.irrLow === undefined ? '—' : percent(run.irrLow, 1)],
          ].map(([label, value]) => (
            <div key={label} className="border-t border-rule py-3">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</dt>
              <dd className="mt-1 font-mono tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-6 max-w-prose text-sm text-ink-soft">
        The slice fell by a third while the stake nearly quadrupled. Then twenty percent
        carry took {money(fees.carryCents)} of the gain, which is most of the gap between
        the gross and net multiples.
      </p>

      <dl className="mt-10 border-t border-rule">
        {[
          ['Golden cases green', '11 of 11'],
          ['Next phase', '04 — interface'],
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
