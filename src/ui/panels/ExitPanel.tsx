import { matures } from '../../engine/instrument'
import type { ScenarioResult } from '../../engine/scenario'
import type { Scenario } from '../../engine/types'
import type { Action } from '../../state/reducer'
import { FeeDrag } from '../charts/FeeDrag'
import { MoneyField, Panel, PercentField, SelectField, Stat, TextField } from '../controls'
import { money, percent } from '../format'

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
  const { exit, fees } = scenario
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
        <PercentField label="Entry fee" value={fees.entry.percent ?? 0} onChange={(percent) => dispatch({ type: 'fees:entry', patch: { percent, rule: 'percent' } })} />
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
      </div>

      <div className="mt-8 border-t border-rule pt-6">
        <FeeDrag
          grossCents={run.exit.lowCents}
          slices={[
            { label: 'Net to you', cents: low.netCents, tone: 'net' },
            { label: 'Carry', cents: low.carryCents, tone: 'fee' },
            { label: 'Fees', cents: low.entryFeeCents + low.managementFeeCents, tone: 'fee' },
          ]}
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
