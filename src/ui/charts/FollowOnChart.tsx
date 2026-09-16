import { useEffect, useId, useState } from 'react'
import { trackOnce } from '../../analytics/track'
import type { PathKind, StrategyPaths } from '../../engine/paths'
import { useMoney } from '../currency'
import { multiple, ownership } from '../format'
import { useWidth } from './useWidth'

/**
 * The same deal three ways — never following on, the cheques you chose, and
 * pro-rata every time — so the gap between them is the price and the reward of
 * your follow-on decisions. Every figure is read from `strategyPaths`, which
 * runs each version through the engine in full.
 */

type View = 'value' | 'ownership'

const VIEWS: ReadonlyArray<readonly [View, string]> = [
  ['value', 'Stake value'],
  ['ownership', 'Ownership'],
]

interface PathStyle {
  kind: PathKind
  title: string
  blurb: string
  stroke: string
  fill: string
  text: string
  bar: string
  dash?: string
}

const PATHS: readonly PathStyle[] = [
  { kind: 'sitOut', title: 'No follow-on', blurb: 'Your first cheque only', stroke: 'stroke-dilute', fill: 'fill-dilute', text: 'text-dilute', bar: 'bg-dilute', dash: '7 6' },
  { kind: 'yours', title: 'Your choices', blurb: 'The follow-ons you chose', stroke: 'stroke-accent', fill: 'fill-accent', text: 'text-accent', bar: 'bg-accent' },
  { kind: 'proRata', title: 'Always pro-rata', blurb: 'Keeping your share every round', stroke: 'stroke-gain', fill: 'fill-gain', text: 'text-gain', bar: 'bg-gain' },
]

/** Your line is drawn last, on top, and wide; where it matches another path both stay visible. */
const DRAW_ORDER: readonly PathStyle[] = [...PATHS].sort((a, b) => Number(a.kind === 'yours') - Number(b.kind === 'yours'))

interface Cell {
  chequeCents: number
  investedCents: number
  ownership: number
  valueLowCents: number
  valueHighCents: number
  multipleLow: number
  multipleHigh: number
}

interface Column {
  key: string
  label: string
  sub: string
  exit: boolean
  pending: boolean
  cells: Record<PathKind, Cell>
}

const KINDS: readonly PathKind[] = ['sitOut', 'yours', 'proRata']

function columnsOf(paths: StrategyPaths, pending: ReadonlySet<string>, compactMoney: (c: number) => string): Column[] {
  // Rounds dated before the entry hold nothing on any path: nothing to draw.
  const first = Math.max(0, paths.yours.points.findIndex((p) => p.ownership > 0 || p.chequeCents > 0))
  const columns: Column[] = paths.yours.points.slice(first).map((point, offset) => {
    const cells = Object.fromEntries(
      KINDS.map((kind) => {
        const p = paths[kind].points[first + offset] ?? point
        const paper = p.cumulativeInvestedCents > 0 ? p.stakeValueCents / p.cumulativeInvestedCents : 0
        const cell: Cell = {
          chequeCents: p.chequeCents,
          investedCents: p.cumulativeInvestedCents,
          ownership: p.ownership,
          valueLowCents: p.stakeValueCents,
          valueHighCents: p.stakeValueCents,
          multipleLow: paper,
          multipleHigh: paper,
        }
        return [kind, cell]
      }),
    ) as Record<PathKind, Cell>
    return { key: point.roundId, label: point.label.trim() || 'Untitled', sub: point.date.slice(0, 4), exit: false, pending: pending.has(point.roundId), cells }
  })

  const exit = paths.yours.scenario.exit
  if (exit.valueCents > 0 && paths.yours.run.totalInvestedCents > 0) {
    const cells = Object.fromEntries(
      KINDS.map((kind) => {
        const run = paths[kind].run
        const cell: Cell = {
          chequeCents: 0,
          investedCents: run.totalInvestedCents,
          ownership: run.finalOwnership,
          valueLowCents: run.feesLow.netCents,
          valueHighCents: run.feesHigh.netCents,
          multipleLow: run.feesLow.netMultiple,
          multipleHigh: run.feesHigh.netMultiple,
        }
        return [kind, cell]
      }),
    ) as Record<PathKind, Cell>
    columns.push({ key: 'exit', label: 'Exit', sub: compactMoney(exit.valueCents), exit: true, pending: false, cells })
  }
  return columns
}

function niceCeiling(max: number): number {
  if (max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= max * 1.04) ?? 10
  return step * magnitude
}

/** A monotone cubic through the points (Fritsch–Carlson): smooth, and never overshooting a value. */
function smooth(points: ReadonlyArray<readonly [number, number]>): string {
  const n = points.length
  const f = (v: number) => v.toFixed(1)
  if (n === 0) return ''
  const [x0, y0] = points[0] as readonly [number, number]
  if (n < 3) return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${f(x)},${f(y)}`).join(' ')
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const [xa, ya] = points[i] as readonly [number, number]
    const [xb, yb] = points[i + 1] as readonly [number, number]
    dx.push(xb - xa)
    m.push((yb - ya) / (xb - xa))
  }
  const t: number[] = [m[0] ?? 0]
  for (let i = 1; i < n - 1; i++) {
    const a = m[i - 1] ?? 0
    const b = m[i] ?? 0
    t.push(a * b <= 0 ? 0 : (a + b) / 2)
  }
  t.push(m[n - 2] ?? 0)
  for (let i = 0; i < n - 1; i++) {
    const slope = m[i] ?? 0
    if (slope === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = (t[i] ?? 0) / slope
    const b = (t[i + 1] ?? 0) / slope
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      t[i] = k * a * slope
      t[i + 1] = k * b * slope
    }
  }
  let d = `M${f(x0)},${f(y0)}`
  for (let i = 0; i < n - 1; i++) {
    const [xa, ya] = points[i] as readonly [number, number]
    const [xb, yb] = points[i + 1] as readonly [number, number]
    const h = (dx[i] ?? 0) / 3
    d += ` C${f(xa + h)},${f(ya + (t[i] ?? 0) * h)} ${f(xb - h)},${f(yb - (t[i + 1] ?? 0) * h)} ${f(xb)},${f(yb)}`
  }
  return d
}

export function FollowOnChart({ paths, pending }: { paths: StrategyPaths; pending: ReadonlySet<string> }) {
  const { money, compactMoney } = useMoney()
  const titleId = useId()
  const gradient = `tp-yours-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [view, setView] = useState<View>('value')
  const columns = columnsOf(paths, pending, compactMoney)
  const [picked, setPicked] = useState<string | undefined>(undefined)
  const found = picked === undefined ? -1 : columns.findIndex((c) => c.key === picked)
  const selectedIndex = found === -1 ? columns.length - 1 : found
  const selected = columns[selectedIndex]
  const [box, width] = useWidth<HTMLDivElement>(1040)

  useEffect(() => trackOnce({ name: 'path_chart_viewed' }), [])

  const end = columns[columns.length - 1]
  if (!selected || !end) return null

  const narrow = width < 560
  const height = narrow ? 240 : 340
  const left = narrow ? 46 : 64
  const right = narrow ? 14 : 132
  const top = 24
  const bottom = 12
  const plotW = Math.max(40, width - left - right)
  const plotH = height - top - bottom
  const slot = plotW / Math.max(1, columns.length - 1)
  const x = (i: number) => (columns.length === 1 ? left + plotW / 2 : left + slot * i)
  const read = (c: Cell) => (view === 'value' ? c.valueHighCents : c.ownership)
  const max = niceCeiling(Math.max(...columns.flatMap((c) => KINDS.map((k) => read(c.cells[k])))))
  const y = (v: number) => top + plotH - (v / max) * plotH
  const tick = (v: number) => (view === 'ownership' ? ownership(v) : compactMoney(v))
  const pointsOf = (kind: PathKind) => columns.map((c, i) => [x(i), y(read(c.cells[kind]))] as const)
  const base = y(0)
  const yoursLine = smooth(pointsOf('yours'))
  const yoursArea = `${yoursLine} L${x(columns.length - 1).toFixed(1)},${base.toFixed(1)} L${x(0).toFixed(1)},${base.toFixed(1)} Z`

  // End labels beside the last point, pushed apart so they never overlap.
  const labels = PATHS.map((p) => ({ p, y: y(read(end.cells[p.kind])), cell: end.cells[p.kind] }))
    .sort((a, b) => a.y - b.y)
    .reduce<Array<{ p: PathStyle; y: number; cell: Cell }>>((placed, label) => {
      const previous = placed[placed.length - 1]
      placed.push({ ...label, y: previous ? Math.max(label.y, previous.y + 34) : label.y })
      return placed
    }, [])

  const range = (low: string, high: string) => (low === high ? high : `${low} – ${high}`)
  const pendingNames = columns.filter((c) => c.pending).map((c) => c.label)
  const same = (a: PathKind, b: PathKind) => columns.every((c) => c.cells[a].investedCents === c.cells[b].investedCents)
  const yoursMatches = same('yours', 'sitOut') ? 'No follow-on' : same('yours', 'proRata') ? 'Always pro-rata' : undefined
  const exitText = end.exit ? `at a ${compactMoney(paths.yours.scenario.exit.valueCents)} exit` : `after ${end.label}`
  const carry = paths.yours.scenario.fees.carry.percent > 0
  const scaleMax = Math.max(...KINDS.flatMap((k) => [end.cells[k].investedCents, end.cells[k].valueHighCents]), 1)
  const sit = end.cells.sitOut
  const pro = end.cells.proRata
  const extraIn = pro.investedCents - sit.investedCents
  const extraOut = pro.valueHighCents - sit.valueHighCents
  // Stake value climbs to the right and ownership falls, so the empty corner of
  // the plot is top-left for one and top-right for the other. On a phone the
  // readout sits under the axis instead of over the lines.
  const tooltipStyle = narrow ? undefined : view === 'value' ? { left: left + 12 } : { left: width - right - 208 - 12 }

  return (
    <section aria-labelledby={titleId} className="relative overflow-hidden rounded-2xl border border-rule bg-surface shadow-card">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">The same company, three ways</p>
        <h3 id={titleId} className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Follow on or sit out?
        </h3>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Only your cheques differ. Compare keeping your first cheque alone, paying your pro-rata in every round, and
          the follow-ons you chose above.
        </p>
      </header>

      <ul className="mt-6 grid gap-px border-y border-rule bg-rule sm:grid-cols-3">
        {PATHS.map((p) => {
          const c = end.cells[p.kind]
          const gain = c.valueHighCents - c.investedCents
          return (
            <li key={p.kind} aria-label={p.title} className={`relative bg-surface px-5 py-5 sm:px-6 ${p.kind === 'yours' ? 'bg-accent-wash/40' : ''}`}>
              <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${p.bar}`} />
              <p className="flex items-baseline justify-between gap-2">
                <span className={`text-sm font-semibold ${p.text}`}>{p.title}</span>
                <span className="text-xs text-ink-faint">
                  {p.kind === 'yours' && yoursMatches ? `same as ${yoursMatches.toLowerCase()}` : p.blurb}
                </span>
              </p>
              <p className="mt-3 font-mono text-3xl font-semibold tracking-tight tabular-nums text-ink">
                {range(compactMoney(c.valueLowCents), compactMoney(c.valueHighCents))}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {end.exit ? `${carry ? 'net ' : ''}${exitText}` : `paper value ${exitText}`} ·{' '}
                <span className="font-mono tabular-nums text-ink">{range(multiple(c.multipleLow), multiple(c.multipleHigh))}</span>
              </p>
              <div aria-hidden="true" className="mt-4 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 font-mono text-[10px] uppercase text-ink-faint">In</span>
                  <span className="h-2 flex-1 bg-sunk">
                    <span className="block h-full bg-ink-faint/60 transition-[width] duration-500" style={{ width: `${(c.investedCents / scaleMax) * 100}%` }} />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-7 font-mono text-[10px] uppercase text-ink-faint">Out</span>
                  <span className="h-2 flex-1 bg-sunk">
                    <span className={`block h-full ${p.bar} transition-[width] duration-500`} style={{ width: `${(c.valueHighCents / scaleMax) * 100}%` }} />
                  </span>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt className="text-ink-faint">Invested</dt>
                <dd className="text-right font-mono tabular-nums text-ink">{money(c.investedCents)}</dd>
                <dt className="text-ink-faint">{gain >= 0 ? 'Gain' : 'Loss'}</dt>
                <dd className={`text-right font-mono tabular-nums ${gain >= 0 ? 'text-gain' : 'text-dilute'}`}>
                  {gain >= 0 ? '+' : '−'}
                  {money(Math.abs(gain))}
                </dd>
                <dt className="text-ink-faint">Ownership</dt>
                <dd className="text-right font-mono tabular-nums text-ink">{ownership(c.ownership)}</dd>
              </dl>
            </li>
          )
        })}
      </ul>

      <div className="px-3 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 px-2">
          <p className="text-sm text-ink-soft">
            {view === 'value' ? 'What your stake is worth, round by round' : 'Your share of the company, round by round'}
          </p>
          <div role="radiogroup" aria-label="Chart shows" className="flex rounded-full bg-sunk p-1">
            {VIEWS.map(([key, text]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={view === key}
                onClick={() => setView(key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  view === key ? 'bg-surface text-accent shadow-sm ring-1 ring-rule' : 'text-ink-faint hover:text-ink'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <div ref={box} className="relative mt-2">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block max-w-full overflow-visible"
            role="img"
            aria-label={`${view === 'value' ? 'Stake value' : 'Ownership'} by round for no follow-on, your choices and always pro-rata. The numbers are in the table that follows.`}
            onMouseLeave={() => setPicked(undefined)}
          >
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--color-accent)', stopOpacity: 0.22 }} />
                <stop offset="100%" style={{ stopColor: 'var(--color-accent)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
              <g key={fraction}>
                <line
                  x1={left}
                  x2={width - right}
                  y1={y(max * fraction)}
                  y2={y(max * fraction)}
                  className="stroke-rule"
                  strokeDasharray={fraction === 0 ? undefined : '2 4'}
                />
                <text x={left - 10} y={y(max * fraction) + 3.5} textAnchor="end" className="fill-ink-faint font-mono text-[10px] tabular-nums">
                  {tick(max * fraction)}
                </text>
              </g>
            ))}
            <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={top - 8} y2={base} className="stroke-rule-strong chart-anim" strokeDasharray="3 3" />
            <path d={yoursArea} fill={`url(#${gradient})`} className="chart-anim pointer-events-none" />
            {DRAW_ORDER.map((p) => (
              <path
                key={p.kind}
                d={smooth(pointsOf(p.kind))}
                fill="none"
                strokeWidth={p.kind === 'yours' ? 4 : 2.25}
                strokeDasharray={p.dash}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`chart-anim pointer-events-none ${p.stroke}`}
              />
            ))}
            {DRAW_ORDER.map((p) =>
              columns.map((c, i) => (
                <circle
                  key={`${p.kind}-${c.key}`}
                  cx={x(i)}
                  cy={y(read(c.cells[p.kind]))}
                  r={i === selectedIndex ? (p.kind === 'yours' ? 6.5 : 5) : p.kind === 'yours' ? 3.5 : 2.5}
                  strokeWidth={i === selectedIndex ? 3 : 0}
                  className={`chart-anim pointer-events-none stroke-surface ${p.fill}`}
                />
              )),
            )}
            {narrow
              ? null
              : labels.map(({ p, y: ly, cell }) => (
                  <g key={p.kind} className="chart-anim pointer-events-none" transform={`translate(${x(columns.length - 1) + 16}, ${ly})`}>
                    <text y={-2} className={`${p.fill} font-mono text-[13px] font-semibold tabular-nums`}>
                      {view === 'value' ? compactMoney(cell.valueHighCents) : ownership(cell.ownership)}
                    </text>
                    <text y={13} className="fill-ink-faint text-[11px]">
                      {p.title}
                    </text>
                  </g>
                ))}
            {columns.map((c, i) => (
              <rect
                key={c.key}
                x={x(i) - slot / 2}
                y={0}
                width={columns.length === 1 ? plotW : slot}
                height={height}
                fill="transparent"
                onMouseEnter={() => setPicked(c.key)}
                onClick={() => setPicked(c.key)}
              />
            ))}
          </svg>

          <div className="relative h-11" style={{ width }}>
            {columns.map((c, i) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={i === selectedIndex}
                aria-label={`Show ${c.exit ? `the exit at ${c.sub}` : `${c.label}, ${c.sub}`}${c.pending ? ', follow-on decision needed' : ''}`}
                onClick={() => setPicked(c.key)}
                onFocus={() => setPicked(c.key)}
                className={`absolute top-1 flex -translate-x-1/2 flex-col items-center rounded-lg px-1.5 py-0.5 font-mono text-[10px] leading-tight outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                  i === selectedIndex ? 'bg-accent-wash text-ink' : 'text-ink-faint hover:text-ink'
                }`}
                style={{ left: x(i), maxWidth: Math.max(slot, 48) }}
              >
                <span className={`max-w-full truncate uppercase tracking-wide ${i === selectedIndex ? 'font-semibold' : ''}`}>
                  {narrow ? c.label.replace(/^Series /, 'S.') : c.label}
                  {c.pending ? <span className="text-dilute"> ?</span> : null}
                </span>
                <span className="tabular-nums">{c.sub}</span>
              </button>
            ))}
          </div>
          <div
            aria-hidden="true"
            className={`pointer-events-none z-10 rounded-xl border border-rule bg-surface/95 p-3 shadow-pop text-xs backdrop-blur ${
              narrow ? 'mx-2 mb-2' : 'absolute top-0 w-52 shadow-[0_12px_32px_-12px_rgb(21_25_34/0.35)]'
            }`}
            style={tooltipStyle}
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              {selected.exit ? `Exit · ${selected.sub}` : `${selected.label} · ${selected.sub}`}
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {PATHS.map((p) => {
                const cell = selected.cells[p.kind]
                return (
                  <li key={p.kind} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      <span className={`h-2 w-2 rounded-full ${p.bar}`} />
                      {p.title}
                    </span>
                    <span className="font-mono tabular-nums text-ink">
                      {view === 'value' ? compactMoney(cell.valueHighCents) : ownership(cell.ownership)}
                    </span>
                  </li>
                )
              })}
            </ul>
            {selected.exit ? null : selected.cells.proRata.chequeCents > 0 ? (
              <p className="mt-2 border-t border-rule pt-2 text-ink-faint">
                Pro-rata cheque here: <span className="font-mono text-ink">{money(selected.cells.proRata.chequeCents)}</span>
              </p>
            ) : null}
          </div>

        </div>
      </div>

      <div className="border-t border-rule bg-ground/40 px-5 py-5 sm:px-8">
        {extraIn > 0 ? (
          <p className="max-w-3xl text-ink-soft">
            {exitText.charAt(0).toUpperCase() + exitText.slice(1)}, paying your pro-rata every round costs{' '}
            <strong className="font-mono tabular-nums text-ink">{money(extraIn)}</strong> more than never following on
            and returns{' '}
            <strong className={`font-mono tabular-nums ${extraOut >= extraIn ? 'text-gain' : 'text-dilute'}`}>
              {extraOut >= 0 ? money(extraOut) : `−${money(-extraOut)}`}
            </strong>{' '}
            more{extraOut > 0 ? ` — ${multiple(extraOut / extraIn)} on the extra money` : ''}. Without following on, your{' '}
            {ownership(columns[0]?.cells.sitOut.ownership ?? 0)} becomes {ownership(sit.ownership)}.
          </p>
        ) : null}
        {pendingNames.length > 0 ? (
          <p className="mt-2 text-sm text-dilute">
            Decide whether you invest in {pendingNames.join(', ')}. Until you do, “Your choices” counts {pendingNames.length > 1 ? 'them' : 'it'} as not participating.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-ink-faint">
          Values before the exit are paper values implied by each round’s valuation, not prices you could sell at.
          Exit figures are hypothetical{carry ? ' and after carry' : ''}. Near the capital raised, liquidation preferences
          can pay you less.
        </p>
      </div>

      <div className="sr-only">
      <table>
        <caption>The three paths, round by round</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
            {PATHS.map((p) => (
              <th key={p.kind} scope="col">
                {p.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c.key}>
              <th scope="row">{c.exit ? `Exit ${c.sub}` : `${c.label} ${c.sub}`}</th>
              {PATHS.map((p) => {
                const cell = c.cells[p.kind]
                return (
                  <td key={p.kind}>
                    {c.exit ? '' : `cheque ${cell.chequeCents > 0 ? money(cell.chequeCents) : 'none'}; `}
                    invested {money(cell.investedCents)}; owns {ownership(cell.ownership)}; {c.exit ? 'net proceeds' : 'paper value'}{' '}
                    {range(money(cell.valueLowCents), money(cell.valueHighCents))}; {range(multiple(cell.multipleLow), multiple(cell.multipleHigh))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  )
}
