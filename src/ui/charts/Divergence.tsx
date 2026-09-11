import { compactMoney, money } from '../format'

/**
 * The same deal down two paths: following on at every round, and never
 * following on. The figure earns its place because the two answers disagree —
 * one wins on dollars and the other on multiple.
 */

export interface DivergenceSeries {
  label: string
  tone: 'gain' | 'dilute'
  /** Stake value at each round, in cents. */
  valuesCents: number[]
  deployedCents: number
  multiple: number
}

const X0 = 55
const X1 = 295
const BASE = 195
const TOP = 30

export function Divergence({
  labels,
  series,
}: {
  labels: string[]
  series: DivergenceSeries[]
}) {
  const peak = Math.max(...series.flatMap((s) => s.valuesCents), 1)
  const scale = (BASE - TOP) / peak
  const step = labels.length > 1 ? (X1 - X0) / (labels.length - 1) : 0
  const x = (i: number) => X0 + step * i
  const y = (cents: number) => BASE - cents * scale

  return (
    <svg viewBox="0 0 470 240" className="mx-auto block h-auto w-full max-w-[560px]" role="img"
      aria-label={series
        .map((s) => `${s.label}: ${money(s.valuesCents[s.valuesCents.length - 1] ?? 0)} on ${money(s.deployedCents)} deployed, ${s.multiple.toFixed(1)} times`)
        .join('. ')}>
      <line x1={X0 - 15} y1={BASE} x2={X1 + 5} y2={BASE} className="stroke-rule-strong" strokeWidth="1" />
      {series.map((s) => {
        const stroke = s.tone === 'gain' ? 'stroke-gain' : 'stroke-dilute'
        const fill = s.tone === 'gain' ? 'fill-gain' : 'fill-dilute'
        const last = s.valuesCents.length - 1
        return (
          <g key={s.label}>
            <polyline
              points={s.valuesCents.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              className={stroke}
              strokeWidth="2.5"
              strokeDasharray={s.tone === 'dilute' ? '6 4' : undefined}
            />
            {s.valuesCents.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3.5" className={fill} />
            ))}
            <text x={X1 + 12} y={y(s.valuesCents[last] ?? 0) - 5} className={`${fill} font-mono text-[10px] tracking-wider`}>
              {s.label.toUpperCase()}
            </text>
            <text x={X1 + 12} y={y(s.valuesCents[last] ?? 0) + 10} className="fill-ink font-mono text-[11px] font-bold tabular-nums">
              {compactMoney(s.valuesCents[last] ?? 0)} · {s.multiple.toFixed(1)}×
            </text>
          </g>
        )
      })}
      {labels.map((label, i) => (
        <text key={label} x={x(i)} y={BASE + 20} textAnchor="middle" className="fill-ink-faint font-mono text-[10px] tracking-wider">
          {label.toUpperCase()}
        </text>
      ))}
    </svg>
  )
}
