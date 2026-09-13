import { useMoney } from '../currency'
import type { ScenarioResult } from '../../engine/scenario'
import { percent } from '../format'

/**
 * Always visible. Ownership never appears without the value beside it, here or
 * anywhere else, because a falling percentage on its own teaches the wrong
 * lesson.
 */
export function SummaryStrip({ run }: { run: ScenarioResult }) {
  const { money } = useMoney()
  const last = run.rounds[run.rounds.length - 1]
  const net = run.feesLow.netMultiple
  const netHigh = run.feesHigh.netMultiple

  const cells: Array<[string, string, string]> = [
    ['Your stake', percent(run.finalOwnership), 'text-dilute'],
    ['Worth now', money(last?.stakeValueCents ?? 0), 'text-gain'],
    ['Deployed', money(run.totalInvestedCents), 'text-ink'],
    [
      'Net multiple',
      run.exit.uncertain ? `${net.toFixed(2)}–${netHigh.toFixed(2)}×` : `${net.toFixed(2)}×`,
      'text-ink',
    ],
  ]

  return (
    <div className="sticky top-0 z-10 border-b border-rule-strong bg-ground/95 backdrop-blur">
      <dl className="mx-auto flex max-w-5xl flex-wrap gap-x-8 gap-y-2 px-5 py-3 sm:px-6">
        {cells.map(([label, value, tone]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</dt>
            <dd className={`font-mono text-sm tabular-nums ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
