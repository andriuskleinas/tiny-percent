import { useMoney } from '../currency'

/**
 * The sale proceeds as one bar, cut to scale into what reaches you and what the
 * syndicate takes as carry. Those two always add up to the proceeds, so the bar
 * is exactly as long as the figure above it.
 *
 * Entry and management fees are not drawn as part of it. They are paid on the
 * way in, never out of the proceeds, and drawing them as a third segment once
 * pushed the bar past the gross figure it was labelled with. They are stated
 * underneath instead, so they stay visible without distorting the scale.
 */

const X0 = 40
const WIDTH = 380
const BAR_Y = 48
const BAR_H = 42

export function FeeDrag({
  grossCents,
  netCents,
  carryCents,
  feesPaidCents,
}: {
  grossCents: number
  netCents: number
  carryCents: number
  /** Entry and management fees, paid separately from the proceeds. */
  feesPaidCents: number
}) {
  const { money } = useMoney()
  // Net and carry sum to gross; scale by their sum so rounding can never overshoot.
  const total = Math.max(netCents + carryCents, 1)
  const netW = (Math.max(0, netCents) / total) * WIDTH
  const carryW = (Math.max(0, carryCents) / total) * WIDTH

  const parts = [
    { key: 'net', label: 'Net to you', cents: netCents, x: X0, w: netW, tone: 'net' as const },
    { key: 'carry', label: 'Carry', cents: carryCents, x: X0 + netW, w: carryW, tone: 'fee' as const },
  ]
  const labelled = parts.filter((p) => p.w >= 34)
  const height = feesPaidCents > 0 ? 172 : 150

  return (
    <svg
      viewBox={`0 0 470 ${height}`}
      className="mx-auto block h-auto w-full max-w-[560px]"
      role="img"
      aria-label={`${money(grossCents)} gross: ${money(netCents)} net to you and ${money(carryCents)} carry.${
        feesPaidCents > 0 ? ` A further ${money(feesPaidCents)} in fees was paid on the way in.` : ''
      }`}
    >
      <text x={X0} y="30" className="fill-ink-faint font-mono text-[10px] tracking-wider">
        {money(grossCents).toUpperCase()} GROSS AT EXIT
      </text>
      {parts.map((p) => (
        <rect
          key={p.key}
          x={p.x}
          y={BAR_Y}
          width={p.w}
          height={BAR_H}
          className={p.tone === 'net' ? 'fill-accent' : 'fill-dilute'}
          opacity={p.tone === 'net' ? 0.8 : 0.85}
        />
      ))}
      {labelled.map((p) => {
        const cx = p.x + p.w / 2
        return (
          <g key={p.key}>
            <line x1={cx} y1={BAR_Y + BAR_H + 2} x2={cx} y2={BAR_Y + BAR_H + 10} className="stroke-rule-strong" strokeWidth="1" />
            <text x={cx} y={BAR_Y + BAR_H + 26} textAnchor="middle" className={`font-mono text-[11px] font-bold tabular-nums ${p.tone === 'net' ? 'fill-ink' : 'fill-dilute'}`}>
              {money(p.cents)}
            </text>
            <text x={cx} y={BAR_Y + BAR_H + 41} textAnchor="middle" className="fill-ink-faint font-mono text-[9px] tracking-wider">
              {p.label.toUpperCase()}
            </text>
          </g>
        )
      })}
      {feesPaidCents > 0 ? (
        <text x={X0} y={height - 6} className="fill-ink-faint text-[11px]">
          Plus {money(feesPaidCents)} in entry and management fees, paid on the way in.
        </text>
      ) : null}
    </svg>
  )
}
