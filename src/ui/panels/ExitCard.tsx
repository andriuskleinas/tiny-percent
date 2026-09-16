import { useId } from 'react'
import type { CSSProperties } from 'react'
import type { Scenario } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { PercentField } from '../controls'
import { useMoney } from '../currency'
import { toCents } from '../../engine/money'
import { SLIDER_POSITIONS, positionOf, stepExit, valueAt } from '../exitScale'

const TICKS = [1e6, 1e7, 1e8, 1e9, 1e10].map(toCents)

/**
 * The exit, reduced to the two things that decide what reaches you: the price
 * the company sells for, dragged along a log scale, and the carry a syndicate
 * takes. Everything it changes shows in the summary beneath it.
 */
export function ExitCard({ scenario, dispatch }: { scenario: Scenario; dispatch: (action: Action) => void }) {
  const { money, compactMoney } = useMoney()
  const titleId = useId()
  const sliderId = useId()
  const value = scenario.exit.valueCents
  const position = positionOf(value)
  const fill = { '--fill': `${(position / SLIDER_POSITIONS) * 100}%` } as CSSProperties
  const setExit = (valueCents: number) => {
    if (valueCents !== value) dispatch({ type: 'exit:set', patch: { valueCents } })
  }

  return (
    <section id="exit" aria-labelledby={titleId} className="scroll-mt-20 rounded-2xl border border-rule bg-surface shadow-card">
      <h2 id={titleId} className="border-b border-rule px-5 py-3 text-base font-semibold text-ink">
        What could it be worth?
      </h2>
      <div className="px-5 py-4">
        <label htmlFor={sliderId} className="text-xs text-ink-faint">
          Exit valuation
        </label>
        <p aria-hidden="true" className="mt-0.5 font-mono text-3xl font-semibold tracking-tight tabular-nums text-ink">
          {value > 0 ? compactMoney(value) : '—'}
        </p>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={SLIDER_POSITIONS}
          step={1}
          value={position}
          aria-valuetext={value > 0 ? money(value) : 'not set'}
          onChange={(e) => setExit(valueAt(Number(e.target.value)))}
          onKeyDown={(e) => {
            // Arrow keys move by half a million (coarser above €100M), not by one
            // position on a log track, which would barely change the value.
            const direction = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
            if (direction === 0) return
            e.preventDefault()
            setExit(stepExit(value, direction))
          }}
          className="tp-range mt-3 w-full"
          style={fill}
        />
        <div aria-hidden="true" className="relative mt-1 h-4 font-mono text-[10px] text-ink-faint">
          {TICKS.map((tick) => (
            <span
              key={tick}
              className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${(positionOf(tick) / SLIDER_POSITIONS) * 100}%` }}
            >
              {compactMoney(tick)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-faint">Drag to set the price the whole company sells for. Arrow keys fine-tune it.</p>

        <div className="mt-4 border-t border-rule pt-4">
          <PercentField
            label="Carry"
            info="carry"
            value={scenario.fees.carry.percent}
            max={50}
            onChange={(percent) => dispatch({ type: 'fees:carry', patch: { percent } })}
            hint="The share of your profit a syndicate or SPV keeps. Use 0% if you invested directly."
          />
        </div>
      </div>
    </section>
  )
}
