import { useMoney } from '../currency'
import { matures } from '../../engine/instrument'
import type { ScenarioResult } from '../../engine/scenario'
import type { Scenario } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { FeeDrag } from '../charts/FeeDrag'
import { MoneyField, NumberField, Panel, PercentField, SelectField, Stat, TextField } from '../controls'
import { percent } from '../format'

const REGIME_TONE: Record<string, string> = {
  clean: 'text-gain',
  uncertain: 'text-ink-soft',
  downside: 'text-dilute',
}

export function ExitPanel({
  scenario,
  run,
  dispatch,
}: {
  scenario: Scenario
  run: ScenarioResult
  dispatch: (action: Action) => void
}) {
  const { money } = useMoney()
  const { exit, fees } = scenario
  const management = fees.management
  const low = run.feesLow
  const high = run.feesHigh
  const band = run.exit.uncertain

  const range = (a: string, b: string) => (band ? `${a} – ${b}` : a)

  return (
    <Panel
      title="The exit"
      lede="What the sale actually pays you, after the preference stack and after the syndicate takes its share."
      aside={
        <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${REGIME_TONE[run.exit.regime]}`}>
          {run.exit.regime} regime
        </span>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyField label="Sale price" valueCents={exit.valueCents} onChange={(valueCents) => dispatch({ type: 'exit:set', patch: { valueCents } })} />
        <TextField label="Date" type="date" value={exit.date} onChange={(date) => dispatch({ type: 'exit:set', patch: { date } })} />
        <MoneyField
          label="Total the company raised"
          valueCents={exit.totalRaisedCents}
          onChange={(totalRaisedCents) => dispatch({ type: 'exit:set', patch: { totalRaisedCents } })}
          hint="This is the preference stack that gets paid before you."
        />
        {matures(scenario.entry.type) ? (
          <SelectField
            label="At maturity your loan"
            value={exit.unconvertedLoan ?? 'convert'}
            options={[
              ['convert', 'Converts to equity'],
              ['repay', 'Is repaid in cash'],
              ['extend', 'Stays outstanding'],
            ] as const}
            onChange={(unconvertedLoan) => dispatch({ type: 'exit:set', patch: { unconvertedLoan } })}
          />
        ) : null}
      </div>

      <p className="mt-5 max-w-prose border-l-2 border-rule-strong pl-4 text-sm text-ink-soft">
        {run.exit.explanation}
      </p>

      <h3 className="mt-8 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        Syndicate terms
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label="Entry fee basis"
          value={fees.entry.rule}
          options={[
            ['percent', 'Percentage of the cheque'],
            ['fixed', 'Fixed amount'],
            ['greater_of', 'Greater of the two'],
          ] as const}
          onChange={(rule) => dispatch({ type: 'fees:entry', patch: { rule } })}
        />
        {/* Each field patches only its own term. Sending the rule along with the
            percentage once silently deleted a fixed minimum fee. */}
        {fees.entry.rule !== 'fixed' ? (
          <PercentField
            label="Entry fee percentage"
            value={fees.entry.percent ?? 0}
            onChange={(percent) => dispatch({ type: 'fees:entry', patch: { percent } })}
          />
        ) : null}
        {fees.entry.rule !== 'percent' ? (
          <MoneyField
            label="Fixed entry fee"
            valueCents={fees.entry.fixedCents ?? 0}
            onChange={(fixedCents) => dispatch({ type: 'fees:entry', patch: { fixedCents } })}
            hint={fees.entry.rule === 'greater_of' ? 'Charged instead when it is larger.' : undefined}
          />
        ) : null}
        <SelectField
          label="Entry fee is"
          value={fees.entry.charged}
          options={[
            ['on_top', 'Charged on top'],
            ['deducted', 'Deducted from the cheque'],
          ] as const}
          onChange={(charged) => dispatch({ type: 'fees:entry', patch: { charged } })}
        />
        <PercentField label="Carry" value={fees.carry.percent} onChange={(percent) => dispatch({ type: 'fees:carry', patch: { percent } })} />
        <PercentField
          label="Hurdle"
          value={fees.carry.hurdlePercent ?? 0}
          onChange={(hurdlePercent) => dispatch({ type: 'fees:carry', patch: { hurdlePercent: hurdlePercent || undefined } })}
          hint="Carry waits until you are this far ahead."
        />
        <SelectField
          label="Management fee"
          value={management?.source ?? 'none'}
          options={[
            ['none', 'None'],
            ['capital', 'Drawn from capital'],
            ['invoiced', 'Invoiced separately'],
          ] as const}
          onChange={(source) =>
            dispatch({
              type: 'fees:management',
              value:
                source === 'none'
                  ? undefined
                  : {
                      annualPercent: management?.annualPercent ?? 0.02,
                      years: management?.years ?? 10,
                      source,
                    },
            })
          }
          hint="Charged on the cheque each year, for the life of the fund."
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

      <div className="mt-8 border-t border-rule pt-6">
        <FeeDrag
          grossCents={run.exit.lowCents}
          netCents={low.netCents}
          carryCents={low.carryCents}
          feesPaidCents={low.entryFeeCents + low.managementFeeCents}
        />
      </div>

      <div className="mt-6 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross proceeds" value={range(money(run.exit.lowCents), money(run.exit.highCents))} tone="soft"
          sub={`on ${percent(run.finalOwnership)} of the company`} />
        <Stat label="Net to you" value={range(money(low.netCents), money(high.netCents))} tone="gain"
          sub={`after ${money(low.dragCents)} of fees`} />
        <Stat label="Gross · net multiple"
          value={band
            ? `${low.grossMultiple.toFixed(2)}–${high.grossMultiple.toFixed(2)}× · ${low.netMultiple.toFixed(2)}–${high.netMultiple.toFixed(2)}×`
            : `${low.grossMultiple.toFixed(2)}× · ${low.netMultiple.toFixed(2)}×`}
          tone="ink" sub={`on ${money(low.outlayCents)} out of pocket`} />
        <Stat label="Net rate of return"
          value={run.irrLow === undefined ? '—' : range(percent(run.irrLow, 1), percent(run.irrHigh ?? run.irrLow, 1))}
          tone="ink" sub="annualised, after every fee" />
      </div>
    </Panel>
  )
}
