import { useMoney } from '../currency'
import { useMemo, useState } from 'react'
import type { ScenarioResult } from '../../engine/scenario'
import { safeRun } from '../safeRun'
import { followOnBreakEven } from '../../engine/ownership'
import type { Scenario } from '../../engine/types'
import { Divergence } from '../charts/Divergence'
import { ValueBridge } from '../charts/ValueBridge'
import type { BridgeStep } from '../charts/ValueBridge'
import { Panel, SelectField } from '../controls'
import { percent } from '../format'

/** Run the same deal with one round's decision swapped out. */
function withAction(
  scenario: Scenario,
  roundId: string,
  kind: 'sit_out' | 'pro_rata',
): ScenarioResult | undefined {
  return safeRun({
    ...scenario,
    rounds: scenario.rounds.map((r) => (r.id === roundId ? { ...r, angelAction: { kind } } : r)),
  }).run
}

/** Run it with every decision swapped, for the two-path chart. */
function allRounds(
  scenario: Scenario,
  kind: 'sit_out' | 'pro_rata',
  entryId: string,
): ScenarioResult | undefined {
  return safeRun({
    ...scenario,
    rounds: scenario.rounds.map((r) => (r.id === entryId ? r : { ...r, angelAction: { kind } })),
  }).run
}

export function FollowOnPanel({ scenario, run }: { scenario: Scenario; run: ScenarioResult }) {
  const { money } = useMoney()
  const entryId = run.rounds.find((s) => s.conversion)?.round.id ?? run.rounds[0]?.round.id ?? ''
  const choosable = run.rounds.filter((s) => s.round.id !== entryId)
  const [selected, setSelected] = useState(choosable[0]?.round.id ?? '')
  const activeId = choosable.some((s) => s.round.id === selected) ? selected : (choosable[0]?.round.id ?? '')

  const state = run.rounds.find((s) => s.round.id === activeId)
  const previous = run.rounds[run.rounds.findIndex((s) => s.round.id === activeId) - 1]

  const paths = useMemo(
    () => ({
      following: allRounds(scenario, 'pro_rata', entryId),
      sitting: allRounds(scenario, 'sit_out', entryId),
    }),
    [scenario, entryId],
  )

  if (!state || !previous || choosable.length === 0 || !paths.following || !paths.sitting) {
    return (
      <Panel title="Following on" lede="Add a second round to compare following on against sitting out.">
        <p className="text-sm text-ink-faint">Nothing to compare yet.</p>
      </Panel>
    )
  }

  const terms = {
    preMoney: state.round.preMoneyCents,
    raised: state.round.raisedCents,
    newOptionPool: state.round.newOptionPool,
  }
  const sitOut = withAction(scenario, activeId, 'sit_out')
  const proRata = withAction(scenario, activeId, 'pro_rata')
  const sitOutState = sitOut?.rounds.find((s) => s.round.id === activeId)
  const proRataState = proRata?.rounds.find((s) => s.round.id === activeId)
  const breakEven = followOnBreakEven(terms, state.proRataCents)

  // The bridge: valuation moving, dilution pulling back, any cheque written.
  const undiluted = Math.round(state.ownershipBefore * state.postMoneyCents)
  const afterDilution = sitOutState?.stakeValueCents ?? 0
  const steps: BridgeStep[] = [
    { label: previous.round.label, deltaCents: previous.stakeValueCents, kind: 'total' },
    { label: 'Valuation', deltaCents: undiluted - previous.stakeValueCents, kind: undiluted >= previous.stakeValueCents ? 'gain' : 'loss' },
    { label: 'Dilution', deltaCents: afterDilution - undiluted, kind: 'loss' },
  ]
  if (state.investedCents > 0) {
    steps.push({ label: 'Your cheque', deltaCents: state.stakeValueCents - afterDilution, kind: 'gain' })
  }
  steps.push({ label: state.round.label, deltaCents: state.stakeValueCents, kind: 'total' })

  const columns = [
    { title: 'Sit out', result: sitOut, at: sitOutState, tone: 'text-dilute' },
    { title: 'Follow pro-rata', result: proRata, at: proRataState, tone: 'text-gain' },
  ].filter((c): c is { title: string; result: ScenarioResult; at: typeof sitOutState; tone: string } =>
    c.result !== undefined,
  )

  return (
    <Panel
      title="Following on"
      lede="Writing the cheque and not writing it, side by side. The two answers usually disagree: one returns more money, the other a better multiple."
      aside={
        choosable.length > 1 ? (
          <div className="w-48">
            <SelectField
              label="Round"
              value={activeId}
              options={choosable.map((s) => [s.round.id, s.round.label] as const)}
              onChange={setSelected}
            />
          </div>
        ) : undefined
      }
    >
      <ValueBridge steps={steps} />
      <p className="mx-auto mt-2 max-w-prose text-center text-xs text-ink-faint">
        Where the change came from at {state.round.label}: the company&rsquo;s valuation moving,
        then dilution pulling some of it back.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {columns.map(({ title, result, at, tone }) => (
          <div key={title} className="border border-rule p-4">
            <h3 className={`font-mono text-[11px] uppercase tracking-wider ${tone}`}>{title}</h3>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              {[
                ['Cheque here', money(title === 'Sit out' ? 0 : (at?.investedCents ?? 0))],
                ['Stake after', percent(at?.ownershipAfter ?? 0)],
                ['Worth after', money(at?.stakeValueCents ?? 0)],
                ['Deployed in total', money(result.totalInvestedCents)],
                ['At exit, net', money(result.feesLow.netCents)],
                ['Net multiple', `${result.feesLow.netMultiple.toFixed(2)}×`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-rule pb-1.5">
                  <dt className="text-ink-faint">{label}</dt>
                  <dd className="font-mono tabular-nums text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {breakEven !== undefined ? (
        <p className="mt-4 max-w-prose text-sm text-ink-soft">
          A pro-rata cheque here costs{' '}
          <span className="font-mono text-ink">{money(state.proRataCents)}</span> and breaks even
          if the company eventually sells for more than{' '}
          <span className="font-mono text-ink">{money(breakEven)}</span>, the post-money you
          would be buying at.
        </p>
      ) : null}

      <div className="mt-8 border-t border-rule pt-6">
        <Divergence
          labels={run.rounds.map((s) => s.round.label)}
          series={[
            {
              label: 'Follow on',
              tone: 'gain',
              valuesCents: paths.following.rounds.map((s) => s.stakeValueCents),
              deployedCents: paths.following.totalInvestedCents,
              multiple: paths.following.feesLow.grossMultiple,
            },
            {
              label: 'Sit out',
              tone: 'dilute',
              valuesCents: paths.sitting.rounds.map((s) => s.stakeValueCents),
              deployedCents: paths.sitting.totalInvestedCents,
              multiple: paths.sitting.feesLow.grossMultiple,
            },
          ]}
        />
        <p className="mx-auto mt-2 max-w-prose text-center text-xs text-ink-faint">
          Following on at every round against never following on. Following deploys{' '}
          {money(paths.following.totalInvestedCents)} and returns{' '}
          {money(paths.following.exit.lowCents)}; sitting out deploys{' '}
          {money(paths.sitting.totalInvestedCents)} and returns{' '}
          {money(paths.sitting.exit.lowCents)}.
        </p>
      </div>
    </Panel>
  )
}
