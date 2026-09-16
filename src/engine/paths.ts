import { ownAfter, proRata } from './ownership'
import { roundTerms, runScenario } from './scenario'
import type { ScenarioResult } from './scenario'
import type { Instrument, Round, Scenario } from './types'

/**
 * The same deal, played three ways: sit out every round after the entry, do
 * what the user entered, or write the pro-rata cheque every time. Only the
 * cheques differ between them — rounds, fees and exit are identical — so the
 * gap between the lines is purely the cost and reward of following on.
 *
 * Each path is a full `runScenario`, so a path's exit figures can never
 * disagree with what the calculator shows for that same scenario.
 */

export type PathKind = 'sitOut' | 'yours' | 'proRata'

export interface PathPoint {
  roundId: string
  label: string
  date: string
  postMoneyCents: number
  ownership: number
  /** The cheque written into this round on this path, 0 when sitting out. */
  chequeCents: number
  cumulativeInvestedCents: number
  stakeValueCents: number
}

export interface StrategyPath {
  kind: PathKind
  scenario: Scenario
  run: ScenarioResult
  points: PathPoint[]
}

export type StrategyPaths = Record<PathKind, StrategyPath>

function pathOf(kind: PathKind, scenario: Scenario): StrategyPath {
  const run = runScenario(scenario)
  let cumulative = 0
  const points = run.rounds.map((state) => {
    cumulative += state.investedCents
    return {
      roundId: state.round.id,
      label: state.round.label,
      date: state.round.date,
      postMoneyCents: state.postMoneyCents,
      ownership: state.ownershipAfter,
      chequeCents: state.investedCents,
      cumulativeInvestedCents: cumulative,
      stakeValueCents: state.stakeValueCents,
    }
  })
  return { kind, scenario, run, points }
}

export function strategyPaths(scenario: Scenario): StrategyPaths {
  const entry = scenario.rounds[0]
  const entryId = entry?.id

  const sitOut: Scenario = {
    ...scenario,
    rounds: scenario.rounds.map((r) => (r.id === entryId ? r : { ...r, participation: undefined })),
  }

  // Pro-rata depends on the position held going into each round, so walk the
  // rounds in the engine's own date order and price each cheque as we go.
  const cheques = new Map<string, number>()
  let held = 0
  for (const round of [...scenario.rounds].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    const terms = roundTerms(round)
    const cheque = round.id === entryId ? (round.participation?.amountCents ?? 0) : held > 0 ? proRata(held, terms) : 0
    cheques.set(round.id, cheque)
    held = ownAfter(held, terms, cheque)
  }
  const chequeFor = (round: Round): Instrument | undefined => {
    if (round.id === entryId) return round.participation
    const amountCents = cheques.get(round.id) ?? 0
    if (amountCents <= 0) return undefined
    const terms = round.participation ?? entry?.participation
    return { type: terms?.type ?? 'equity', entryFee: terms?.entryFee ?? { rule: 'percent', percent: 0 }, amountCents }
  }
  const proRataScenario: Scenario = { ...scenario, rounds: scenario.rounds.map((r) => ({ ...r, participation: chequeFor(r) })) }

  return {
    sitOut: pathOf('sitOut', sitOut),
    yours: pathOf('yours', scenario),
    proRata: pathOf('proRata', proRataScenario),
  }
}
