import { compactMoney, money } from '../format'

/**
 * One round split into the forces acting on it: the company's valuation moving,
 * dilution pulling back, and any cheque written. The bars must close on the end
 * value, which is what makes it a bridge rather than a chart of four numbers.
 */

export interface BridgeStep {
  label: string
  /** Signed contribution in cents. The first and last steps are totals. */
  deltaCents: number
  kind: 'total' | 'gain' | 'loss'
}

const BASE = 200
const TOP = 40
const X0 = 55
const X1 = 425

export function ValueBridge({ steps }: { steps: BridgeStep[] }) {
  // Running totals give every floating bar its top and bottom.
  let running = 0
  const bars = steps.map((step) => {
    const from = step.kind === 'total' ? 0 : running
    const to = step.kind === 'total' ? step.deltaCents : running + step.deltaCents
    if (step.kind !== 'total') running = to
    else running = step.deltaCents
    return { ...step, from, to }
  })

  const peak = Math.max(...bars.flatMap((b) => [b.from, b.to]), 1)
  const scale = (BASE - TOP) / peak
  const slot = (X1 - X0) / bars.length
  const w = Math.min(slot * 0.66, 70)

  return (
    <svg viewBox="0 0 470 250" className="mx-auto block h-auto w-full max-w-[560px]" role="img"
      aria-label={bars.map((b) => `${b.label} ${money(b.deltaCents)}`).join(', ')}>
      <line x1={X0} y1={BASE} x2={X1} y2={BASE} className="stroke-rule-strong" strokeWidth="1" />
      {bars.map((b, i) => {
        const cx = X0 + slot * (i + 0.5)
        const top = BASE - Math.max(b.from, b.to) * scale
        const height = Math.max(2, Math.abs(b.to - b.from) * scale)
        const fill = b.kind === 'gain' ? 'fill-gain' : b.kind === 'loss' ? 'fill-dilute' : 'fill-accent'
        const next = bars[i + 1]
        return (
          <g key={b.label}>
            {next ? (
              <line
                x1={cx + w / 2}
                y1={BASE - b.to * scale}
                x2={cx + slot - w / 2}
                y2={BASE - b.to * scale}
                className="stroke-rule-strong"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ) : null}
            <rect x={cx - w / 2} y={top} width={w} height={height} className={fill} opacity={b.kind === 'total' ? 0.65 : 0.8} />
            <text
              x={cx}
              y={top - 8}
              textAnchor="middle"
              className={`font-mono text-[11px] font-bold tabular-nums ${b.kind === 'gain' ? 'fill-gain' : b.kind === 'loss' ? 'fill-dilute' : 'fill-ink'}`}
            >
              {b.kind === 'total' ? compactMoney(b.deltaCents) : `${b.deltaCents >= 0 ? '+' : '−'}${compactMoney(Math.abs(b.deltaCents))}`}
            </text>
            <text x={cx} y={BASE + 20} textAnchor="middle" className="fill-ink-faint font-mono text-[9px] tracking-wider">
              {b.label.toUpperCase()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
