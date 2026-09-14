import { useMemo } from 'react'
import { useMoney } from '../currency'
import { outcomesAt } from '../../engine/scenario'
import type { ExitOutcome, ScenarioResult } from '../../engine/scenario'
import type { Scenario } from '../../engine/types'
import { EXIT_PRESETS_CENTS } from '../../state/presets'
import type { Action } from '../../state/reducer'
import { FeeDrag } from '../charts/FeeDrag'
import { ChoiceGroup, Disclosure, InfoTip, MoneyField, NumberField, Panel, PercentField, Stat, SwitchField, TextField } from '../controls'
import { EXIT_DISCLAIMER, hasFees } from '../facts'
import { multiple, ownership, percent } from '../format'

/** "€5,000" or "€5,000 – €25,600" when the preference stack decides the answer. */
function band(low: string, high: string, uncertain: boolean): string {
  return uncertain && low !== high ? `${low} – ${high}` : high
}

export function ExitPanel({
  scenario,
  workable,
  run,
  dispatch,
}: {
  /** What the user typed. Drives the inputs. */
  scenario: Scenario
  /** The last scenario that ran, and its result. Anything that runs the engine uses these, never `scenario`. */
  workable: Scenario
  run: ScenarioResult
  dispatch: (action: Action) => void
}) {
  const { money, compactMoney } = useMoney()
  const { exit, fees } = scenario
  const management = fees.management
  const { feesLow: low, feesHigh: high } = run
  const uncertain = run.exit.uncertain
  const feesApply = hasFees(scenario) || low.entryFeeCents > 0
  const preset = EXIT_PRESETS_CENTS.includes(exit.valueCents) ? String(exit.valueCents) : undefined
  const setExit = (patch: Partial<Scenario['exit']>) => dispatch({ type: 'exit:set', patch })

  const rows = useMemo(() => {
    const value = workable.exit.valueCents
    const values = EXIT_PRESETS_CENTS.includes(value) ? EXIT_PRESETS_CENTS : [...EXIT_PRESETS_CENTS, value].sort((a, b) => a - b)
    return outcomesAt(workable, values.filter((v) => v > 0))
  }, [workable])

  return (
    <Panel
      id="exit"
      title="What could your investment be worth?"
      lede="Pick a hypothetical price for the whole company when it is sold, and see what your stake could return."
    >
      <div className="flex flex-col gap-4">
        <div>
          <p aria-hidden="true" className="mb-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Exit valuation
          </p>
          <ChoiceGroup
            label="Exit valuation"
            value={preset}
            options={EXIT_PRESETS_CENTS.map((cents) => [String(cents), compactMoney(cents)] as const)}
            onChange={(value) => setExit({ valueCents: Number(value) })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField
            label="Custom exit valuation"
            valueCents={exit.valueCents}
            onChange={(valueCents) => setExit({ valueCents })}
            placeholder="e.g. 75m"
          />
          <TextField label="Exit date" type="date" value={exit.date} onChange={(date) => setExit({ date })} />
        </div>
      </div>

      {exit.valueCents > 0 && run.totalInvestedCents > 0 ? (
        <div aria-live="polite" className="mt-6 border border-rule bg-sunk/60 p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Potential gross proceeds at a {money(exit.valueCents)} exit
          </p>
          <p className="mt-1 font-mono text-4xl font-semibold tracking-tight tabular-nums text-gain">
            {band(money(run.exit.lowCents), money(run.exit.highCents), uncertain)}
          </p>
          <div className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Final ownership" value={ownership(run.finalOwnership)} />
            <Stat label="Total invested" value={money(run.totalInvestedCents)} sub={low.outlayCents > run.totalInvestedCents ? `${money(low.outlayCents)} paid including fees` : undefined} />
            <Stat
              label={feesApply ? 'MOIC after fees' : 'MOIC'}
              info="moic"
              value={band(multiple(low.netMultiple), multiple(high.netMultiple), uncertain)}
              sub={feesApply ? 'proceeds after carry ÷ total paid' : 'potential proceeds ÷ total invested'}
            />
            {feesApply ? (
              <Stat
                label="After fees and carry"
                value={band(money(low.netCents), money(high.netCents), uncertain)}
                tone="gain"
                sub={`${money(low.carryCents)} carry`}
              />
            ) : null}
            <Stat
              label="IRR"
              info="irr"
              value={run.irrLow === undefined ? '—' : band(percent(run.irrLow, 1), percent(run.irrHigh ?? run.irrLow, 1), uncertain)}
              sub="a year, from your investment dates to the exit date"
            />
          </div>

          {run.exit.regime === 'clean' ? null : (
            <p className="mt-4 flex gap-2 border-l-2 border-dilute pl-3 text-sm text-ink-soft">
              <span>{run.exit.explanation}</span>
              <InfoTip term="preferences" />
            </p>
          )}
        </div>
      ) : (
        <p className="mt-6 border border-dashed border-rule-strong px-5 py-6 text-center text-sm text-ink-soft">
          {run.totalInvestedCents > 0
            ? 'Choose an exit valuation to see what your stake could return.'
            : 'Enter your investment above to see what it could return.'}
        </p>
      )}

      <p className="mt-3 text-xs text-ink-faint">{EXIT_DISCLAIMER}</p>

      {run.totalInvestedCents > 0 && rows.length > 0 ? (
        <div className="mt-8">
          <ExitTable rows={rows} selectedCents={exit.valueCents} feesApply={feesApply} finalOwnership={run.finalOwnership} totalRaisedCents={exit.totalRaisedCents} />
        </div>
      ) : null}

      <div className="mt-8">
        <Disclosure summary="Advanced: capital raised before the exit, carry and management fee" defaultOpen={hasFees(scenario)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              label="Total the company raised"
              info="preferences"
              valueCents={exit.totalRaisedCents}
              onChange={(totalRaisedCents) => setExit({ totalRaisedCents })}
              hint="Filled in from your rounds. Investors’ preferences are paid before common shares at a low exit."
            />
          </div>
          <h3 className="mt-6 font-mono text-[10px] uppercase tracking-wider text-ink-faint">Syndicate or SPV fees</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PercentField label="Carry" info="carry" value={fees.carry.percent} onChange={(percent) => dispatch({ type: 'fees:carry', patch: { percent } })} />
            <SwitchField
              label="Management fee"
              info="managementFee"
              value={management ? 'on' : 'off'}
              options={[
                ['off', 'None'],
                ['on', 'Charged'],
              ] as const}
              onChange={(choice) =>
                dispatch({
                  type: 'fees:management',
                  value: choice === 'off' ? undefined : { annualPercent: management?.annualPercent ?? 0.02, years: management?.years ?? 10 },
                })
              }
            />
            {management ? (
              <>
                <PercentField
                  label="Management fee per year"
                  value={management.annualPercent}
                  onChange={(annualPercent) => dispatch({ type: 'fees:management', value: { ...management, annualPercent } })}
                />
                <NumberField
                  label="Charged for how many years"
                  value={management.years}
                  max={30}
                  onChange={(years) => dispatch({ type: 'fees:management', value: { ...management, years } })}
                />
              </>
            ) : null}
          </div>
          {feesApply && run.totalInvestedCents > 0 && exit.valueCents > 0 ? (
            <div className="mt-6 border-t border-rule pt-6">
              <FeeDrag
                grossCents={run.exit.lowCents}
                netCents={low.netCents}
                carryCents={low.carryCents}
                feesPaidCents={low.entryFeeCents + low.managementFeeCents}
              />
            </div>
          ) : null}
        </Disclosure>
      </div>
    </Panel>
  )
}

function ExitTable({
  rows,
  selectedCents,
  feesApply,
  finalOwnership,
  totalRaisedCents,
}: {
  rows: ExitOutcome[]
  selectedCents: number
  feesApply: boolean
  finalOwnership: number
  totalRaisedCents: number
}) {
  const { money, compactMoney } = useMoney()
  const flagged = rows.some((r) => r.exit.regime !== 'clean')
  const proceeds = (r: ExitOutcome) => band(money(r.exit.lowCents), money(r.exit.highCents), r.exit.uncertain)
  const moic = (r: ExitOutcome) => band(multiple(r.feesLow.netMultiple), multiple(r.feesHigh.netMultiple), r.exit.uncertain)
  const mark = (r: ExitOutcome) => (r.exit.regime === 'clean' ? '' : ' *')

  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Compare hypothetical exits</h3>
      <table className="mt-2 hidden w-full border-collapse text-sm sm:table">
        <caption className="sr-only">Your potential proceeds at each exit valuation, holding {ownership(finalOwnership)}</caption>
        <thead>
          <tr className="border-b border-rule-strong text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            <th scope="col" className="py-2 pr-3 font-normal">Exit valuation</th>
            <th scope="col" className="px-3 py-2 text-right font-normal">Your ownership</th>
            <th scope="col" className="px-3 py-2 text-right font-normal">Potential proceeds</th>
            <th scope="col" className="py-2 pl-3 text-right font-normal">MOIC</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map((r) => {
            const selected = r.valueCents === selectedCents
            return (
              <tr key={r.valueCents} aria-current={selected ? 'true' : undefined} className={`border-b border-rule ${selected ? 'bg-accent-wash' : ''}`}>
                <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                  {compactMoney(r.valueCents)}
                  {mark(r)}
                  {selected ? <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">selected</span> : null}
                </th>
                <td className="px-3 py-2 text-right text-ink-soft">{ownership(finalOwnership)}</td>
                <td className="px-3 py-2 text-right text-gain">{proceeds(r)}</td>
                <td className="py-2 pl-3 text-right text-ink">{moic(r)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <ul className="mt-2 flex flex-col gap-2 sm:hidden">
        {rows.map((r) => {
          const selected = r.valueCents === selectedCents
          return (
            <li key={r.valueCents} aria-current={selected ? 'true' : undefined} className={`border p-3 ${selected ? 'border-accent bg-accent-wash' : 'border-rule'}`}>
              <p className="flex justify-between font-mono text-sm text-ink">
                <span>
                  {compactMoney(r.valueCents)} exit{mark(r)}
                </span>
                <span>{moic(r)}</span>
              </p>
              <p className="mt-1 flex justify-between text-sm">
                <span className="text-ink-faint">Potential proceeds</span>
                <span className="font-mono tabular-nums text-gain">{proceeds(r)}</span>
              </p>
            </li>
          )
        })}
      </ul>

      <p className="mt-2 text-xs text-ink-faint">
        {flagged
          ? `* At or not far above the ${money(totalRaisedCents)} the company raised, investors’ liquidation preferences are paid first, so proceeds can be less than your ownership share. A range means the outcome depends on terms this calculator does not model. `
          : ''}
        Every row assumes you hold your final ownership to the exit. MOIC is{' '}
        {feesApply ? 'proceeds after carry divided by the total you paid.' : 'potential proceeds divided by the total you invested.'}
      </p>
    </div>
  )
}
