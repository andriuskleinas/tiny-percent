import { useMoney } from '../currency'
import { percent } from '../format'

/**
 * Width is ownership, height is the company's valuation, so the area of each
 * rectangle is what the stake is worth. The shapes narrow and grow taller, and
 * they get bigger. This is the figure the product exists to draw.
 */

export interface AreaPoint {
  label: string
  ownership: number
  valuationCents: number
  valueCents: number
}

const X0 = 60
const X1 = 425
const BASE = 225
const MAX_H = 180

export function AreaWealth({ points }: { points: AreaPoint[] }) {
  const { money, compactMoney } = useMoney()
  const maxOwn = Math.max(...points.map((p) => p.ownership), 0)
  const maxVal = Math.max(...points.map((p) => p.valuationCents), 1)

  if (points.length === 0 || maxOwn <= 0) {
    return <p className="py-8 text-center text-sm text-ink-faint">No stake to draw yet.</p>
  }

  const slot = (X1 - X0) / points.length
  const maxBarW = Math.min(slot * 0.78, 110)

  return (
    <svg viewBox="0 0 470 280" className="mx-auto block h-auto w-full max-w-[560px]" role="img"
      aria-label={points
        .map((p) => `${p.label}: ${percent(p.ownership)} of ${money(p.valuationCents)}, worth ${money(p.valueCents)}`)
        .join('. ')}>
      <text
        className="fill-ink-faint font-mono text-[10px] tracking-wider"
        transform={`rotate(-90 44 ${(BASE + BASE - MAX_H) / 2})`}
        x="44"
        y={(BASE + BASE - MAX_H) / 2}
        textAnchor="middle"
      >
        VALUATION
      </text>
      <line x1={X0} y1={BASE} x2={X1} y2={BASE} className="stroke-rule-strong" strokeWidth="1" />
      {points.map((p, i) => {
        const cx = X0 + slot * (i + 0.5)
        const w = Math.max(2, (p.ownership / maxOwn) * maxBarW)
        const h = Math.max(2, (p.valuationCents / maxVal) * MAX_H)
        return (
          <g key={p.label}>
            <rect
              x={cx - w / 2}
              y={BASE - h}
              width={w}
              height={h}
              className="fill-accent"
              opacity={0.4 + (0.5 * (i + 1)) / points.length}
            />
            <text x={cx} y={BASE - h - 8} textAnchor="middle" className="fill-ink font-mono text-[11px] font-bold tabular-nums">
              {compactMoney(p.valueCents)}
            </text>
            <text x={cx} y={BASE + 20} textAnchor="middle" className="fill-ink-faint font-mono text-[9px] tracking-wider">
              {percent(p.ownership)} OF {compactMoney(p.valuationCents)}
            </text>
            <text x={cx} y={BASE + 41} textAnchor="middle" className="fill-ink-faint font-mono text-[10px] tracking-wider">
              {p.label.toUpperCase()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
