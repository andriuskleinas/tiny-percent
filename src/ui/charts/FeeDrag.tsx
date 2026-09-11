import { money } from '../format'

/**
 * Exit proceeds as one bar, cut to scale into what reaches you and what does
 * not. Drawn at real proportions, so a fee that looks small in a table looks
 * small here too, and one that does not, does not.
 */

export interface DragSlice {
  label: string
  cents: number
  tone: 'net' | 'fee'
}

const X0 = 40
const WIDTH = 380
const BAR_Y = 48
const BAR_H = 42

export function FeeDrag({ grossCents, slices }: { grossCents: number; slices: DragSlice[] }) {
  const total = Math.max(grossCents, 1)
  let cursor = X0

  const placed = slices.map((slice) => {
    const w = (Math.max(0, slice.cents) / total) * WIDTH
    const at = cursor
    cursor += w
    return { ...slice, x: at, w }
  })

  // Only label a slice wide enough to carry one without colliding with its neighbours.
  const labelled = placed.filter((s) => s.w >= 34)

  return (
    <svg viewBox="0 0 470 150" className="mx-auto block h-auto w-full max-w-[560px]" role="img"
      aria-label={`${money(grossCents)} gross, split into ${slices.map((s) => `${money(s.cents)} ${s.label}`).join(', ')}`}>
      <text x={X0} y="30" className="fill-ink-faint font-mono text-[10px] tracking-wider">
        {money(grossCents).toUpperCase()} GROSS AT EXIT
      </text>
      {placed.map((s) => (
        <rect
          key={s.label}
          x={s.x}
          y={BAR_Y}
          width={Math.max(s.w, s.cents > 0 ? 2 : 0)}
          height={BAR_H}
          className={s.tone === 'net' ? 'fill-accent' : 'fill-dilute'}
          opacity={s.tone === 'net' ? 0.8 : 0.85}
        />
      ))}
      {labelled.map((s) => {
        const cx = s.x + s.w / 2
        return (
          <g key={s.label}>
            <line x1={cx} y1={BAR_Y + BAR_H + 2} x2={cx} y2={BAR_Y + BAR_H + 10} className="stroke-rule-strong" strokeWidth="1" />
            <text x={cx} y={BAR_Y + BAR_H + 26} textAnchor="middle" className={`font-mono text-[11px] font-bold tabular-nums ${s.tone === 'net' ? 'fill-ink' : 'fill-dilute'}`}>
              {money(s.cents)}
            </text>
            <text x={cx} y={BAR_Y + BAR_H + 41} textAnchor="middle" className="fill-ink-faint font-mono text-[9px] tracking-wider">
              {s.label.toUpperCase()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
