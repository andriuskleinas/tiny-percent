import { useId, useState } from 'react'
import type { MouseEvent } from 'react'
import { outcomesAt } from '../../engine/scenario'
import type { ScenarioResult } from '../../engine/scenario'
import type { Scenario } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { useMoney } from '../currency'
import { EXIT_STOPS_CENTS, nearestStop, roundExit } from '../exitScale'
import { multiple, ownership, roundName } from '../format'
import { useWidth } from './useWidth'

/**
 * With a single cheque and no later rounds there is nothing to compare yet, so
 * this draws the question that does exist: what the stake returns at every
 * price the company could sell for. The curve is a full engine run at each
 * slider stop, so it bends where liquidation preferences take over, and the
 * point on it is the exit chosen in the slider — click the curve to move it.
 */

function niceCeiling(max: number): number {
  if (max <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(max))
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= max * 1.04) ?? 10
  return step * magnitude
}

export function ReturnCurveChart({ scenario, run, dispatch }: { scenario: Scenario; run: ScenarioResult; dispatch: (action: Action) => void }) {
  const { money, compactMoney } = useMoney()
  const titleId = useId()
  const gradient = `tp-curve-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [box, width] = useWidth<HTMLDivElement>(1040)
  const [hovered, setHovered] = useState<number | undefined>(undefined)

  const exitCents = scenario.exit.valueCents
  const invested = run.totalInvestedCents
  const entry = run.rounds[0]
  // Wide enough to see well past the chosen exit, never wider than the slider.
  const lastIndex = Math.min(EXIT_STOPS_CENTS.length - 1, Math.max(nearestStop(exitCents * 10), nearestStop(100_000_000_00)))
  const domain = EXIT_STOPS_CENTS.slice(0, lastIndex + 1)
  const lo = domain[0] ?? 1
  const hi = domain[domain.length - 1] ?? 1

  // About forty engine runs, each a few rounds long: cheap enough to redo on every render.
  const outcomes = outcomesAt(
    scenario,
    [...new Set([...domain, exitCents].filter((v) => v > 0 && v <= hi))].sort((a, b) => a - b),
  )

  const narrow = width < 560
  const height = narrow ? 240 : 320
  const left = narrow ? 48 : 70
  const right = narrow ? 14 : 28
  const top = 20
  const bottom = 12
  const plotW = Math.max(40, width - left - right)
  const plotH = height - top - bottom
  const x = (v: number) => left + ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * plotW
  const max = niceCeiling(Math.max(...outcomes.map((o) => o.feesHigh.netCents), invested))
  const y = (v: number) => top + plotH - (v / max) * plotH
  const base = y(0)
  type Outcome = (typeof outcomes)[number]
  const line = (pick: (o: Outcome) => number, from: readonly Outcome[] = outcomes) =>
    from.map((o, i) => `${i === 0 ? 'M' : 'L'}${x(o.valueCents).toFixed(1)},${y(pick(o)).toFixed(1)}`).join(' ')
  const high = line((o) => o.feesHigh.netCents)
  const lowReversed = [...outcomes]
    .reverse()
    .map((o) => `L${x(o.valueCents).toFixed(1)},${y(o.feesLow.netCents).toFixed(1)}`)
    .join(' ')
  const first = outcomes[0]
  const last = outcomes[outcomes.length - 1]
  const area = first && last ? `${high} L${x(last.valueCents).toFixed(1)},${base.toFixed(1)} L${x(first.valueCents).toFixed(1)},${base.toFixed(1)} Z` : ''
  const preferencesEdge = Math.min(scenario.exit.totalRaisedCents * 2, hi)
  const ticks = domain.filter((v) => Math.log10(v / 100) % 1 === 0)

  const chosen = outcomes.find((o) => o.valueCents === exitCents)
  const shown = outcomes.find((o) => o.valueCents === hovered) ?? chosen
  const range = (low: string, highText: string) => (low === highText ? highText : `${low} – ${highText}`)
  // Where the money comes back for good: the lowest exit above which every
  // larger one returns at least what was invested, preferences or not.
  let breakEven: Outcome | undefined
  for (let i = outcomes.length - 1; i >= 0; i--) {
    const o = outcomes[i]
    if (!o || o.feesLow.netCents < invested) break
    breakEven = o
  }
  // Inside the preference zone the answer depends on terms nobody entered, so
  // that stretch is drawn dashed; the solid line is where ownership decides.
  const clean = outcomes.filter((o) => o.exit.regime === 'clean')
  const unclear = outcomes.filter((o) => o.exit.regime !== 'clean')

  const valueAt = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const logValue = Math.log(lo) + ((px - left) / plotW) * (Math.log(hi) - Math.log(lo))
    return roundExit(Math.min(hi, Math.exp(logValue)))
  }

  if (!entry || !chosen || !shown || invested <= 0) return null
  const chosenX = x(chosen.valueCents)
  const flip = chosenX > left + plotW * 0.6

  return (
    <section aria-labelledby={titleId} className="relative overflow-hidden rounded-2xl border border-rule bg-surface shadow-card">
      <header className="px-5 pt-6 sm:px-8 sm:pt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">One cheque, every possible exit</p>
        <h3 id={titleId} className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          From cheque to exit
        </h3>
        <p className="mt-2 max-w-2xl text-ink-soft">
          What your {money(invested)} {roundName(entry.round)} cheque returns at every price the company could sell for.
          Drag the exit slider, or click the curve.
        </p>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-px border-y border-rule bg-rule sm:grid-cols-4">
        {(
          [
            ['You invest', money(invested), 'text-ink'],
            ['You own', ownership(run.finalOwnership), 'text-ink'],
            [`Net at a ${compactMoney(exitCents)} exit`, range(money(chosen.feesLow.netCents), money(chosen.feesHigh.netCents)), 'text-gain'],
            ['Multiple', range(multiple(chosen.feesLow.netMultiple), multiple(chosen.feesHigh.netMultiple)), 'text-ink'],
          ] as const
        ).map(([label, value, tone]) => (
          <div key={label} className="bg-surface px-5 py-4 sm:px-6">
            <dt className="text-xs text-ink-faint">{label}</dt>
            <dd className={`mt-1 font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="px-3 pt-5 sm:px-6">
        <p className="px-2 text-sm text-ink-soft">What reaches you{scenario.fees.carry.percent > 0 ? ' after carry' : ''}, by exit valuation</p>
        <div ref={box} className="relative mt-2">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block max-w-full cursor-crosshair"
            role="img"
            aria-label={`Net proceeds by exit valuation, from ${compactMoney(lo)} to ${compactMoney(hi)}. At the chosen ${compactMoney(exitCents)} exit you receive ${range(money(chosen.feesLow.netCents), money(chosen.feesHigh.netCents))} on ${money(invested)} invested.`}
            onMouseMove={(e) => setHovered(valueAt(e))}
            onMouseLeave={() => setHovered(undefined)}
            onClick={(e) => {
              const value = valueAt(e)
              if (value !== undefined) dispatch({ type: 'exit:set', patch: { valueCents: value } })
            }}
          >
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--color-gain)', stopOpacity: 0.22 }} />
                <stop offset="100%" style={{ stopColor: 'var(--color-gain)', stopOpacity: 0 }} />
              </linearGradient>
            </defs>

            {preferencesEdge > lo ? (
              <g>
                <rect x={left} y={top} width={x(preferencesEdge) - left} height={plotH} className="fill-dilute/[0.06]" />
                <text x={left + 8} y={top + 14} className="fill-dilute font-mono text-[10px] uppercase tracking-wider">
                  {narrow ? 'Preferences' : 'Liquidation preferences can pay less'}
                </text>
              </g>
            ) : null}

            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={left} x2={width - right} y1={y(max * f)} y2={y(max * f)} className="stroke-rule" strokeDasharray={f === 0 ? undefined : '2 4'} />
                <text x={left - 10} y={y(max * f) + 3.5} textAnchor="end" className="fill-ink-faint font-mono text-[10px] tabular-nums">
                  {compactMoney(max * f)}
                </text>
              </g>
            ))}

            <line x1={left} x2={width - right} y1={y(invested)} y2={y(invested)} className="stroke-ink-faint" strokeDasharray="5 5" />
            <text x={width - right} y={y(invested) - 6} textAnchor="end" className="fill-ink-soft text-[11px]">
              You invested {compactMoney(invested)}
            </text>

            <path d={area} fill={`url(#${gradient})`} className="chart-anim pointer-events-none" />
            <path d={`${high} ${lowReversed} Z`} className="chart-anim pointer-events-none fill-gain/20" />
            {unclear.length > 1 ? (
              <path d={line((o) => o.feesHigh.netCents, unclear)} fill="none" strokeWidth={2} strokeDasharray="4 4" className="pointer-events-none stroke-gain" />
            ) : null}
            {clean.length > 1 ? (
              <path d={line((o) => o.feesHigh.netCents, clean)} fill="none" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="chart-anim pointer-events-none stroke-gain" />
            ) : null}

            {hovered !== undefined && hovered !== chosen.valueCents ? (
              <line x1={x(hovered)} x2={x(hovered)} y1={top} y2={base} className="pointer-events-none stroke-rule-strong" strokeDasharray="3 3" />
            ) : null}

            <line x1={chosenX} x2={chosenX} y1={y(chosen.feesHigh.netCents)} y2={base} className="chart-anim pointer-events-none stroke-accent" strokeWidth={1.5} />
            <circle cx={chosenX} cy={y(chosen.feesHigh.netCents)} r={7} strokeWidth={3} className="chart-anim pointer-events-none fill-accent stroke-surface" />
            {narrow ? null : (
              <g className="pointer-events-none" transform={`translate(${chosenX + (flip ? -12 : 12)}, ${Math.max(top + 30, y(chosen.feesHigh.netCents) - 12)})`}>
                <text textAnchor={flip ? 'end' : 'start'} className="fill-ink font-mono text-[13px] font-semibold tabular-nums">
                  {compactMoney(chosen.feesHigh.netCents)} · {multiple(chosen.feesHigh.netMultiple)}
                </text>
                <text y={15} textAnchor={flip ? 'end' : 'start'} className="fill-ink-faint text-[11px]">
                  at a {compactMoney(exitCents)} exit
                </text>
              </g>
            )}
          </svg>

          <div aria-hidden="true" className="relative h-6" style={{ width }}>
            {ticks.map((v) => (
              <span key={v} className="absolute top-1 -translate-x-1/2 font-mono text-[10px] text-ink-faint" style={{ left: x(v) }}>
                {compactMoney(v)}
              </span>
            ))}
          </div>

          <p aria-live="polite" className="mx-2 mb-2 mt-2 font-mono text-xs tabular-nums text-ink-soft">
            {hovered !== undefined ? 'Hovering' : 'Chosen'}: a {compactMoney(shown.valueCents)} exit pays you{' '}
            <span className="text-gain">{range(money(shown.feesLow.netCents), money(shown.feesHigh.netCents))}</span> ·{' '}
            {range(multiple(shown.feesLow.netMultiple), multiple(shown.feesHigh.netMultiple))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-rule bg-ground/40 px-5 py-5 sm:px-8">
        <p className="max-w-2xl text-ink-soft">
          {breakEven ? `You get your money back from about a ${compactMoney(breakEven.valueCents)} exit. ` : ''}
          This curve assumes no later rounds. Add one to see how dilution lowers it, and what following on would add back.
        </p>
        <button
          type="button"
          onClick={() => {
            const panel = document.getElementById('future-rounds')
            panel?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
            panel?.querySelector<HTMLButtonElement>('header button')?.focus({ preventScroll: true })
          }}
          className="shrink-0 rounded-full border border-accent bg-accent px-5 py-2.5 shadow-sm text-sm font-medium text-on-accent outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          Add a funding round
        </button>
      </div>
    </section>
  )
}
