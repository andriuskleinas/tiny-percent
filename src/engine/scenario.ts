import { applyFees, entryFeeFor } from './fees'
import type { ChequeCost, FeeResult } from './fees'
import { exitProceeds } from './exit'
import type { ExitProceeds } from './exit'
import { irr } from './irr'
import type { CashFlow } from './irr'
import { ownAfter, postMoney, proRata, stakeValue } from './ownership'
import type { RoundTerms } from './ownership'
import type { Round, Scenario } from './types'

/**
 * Runs a whole scenario and keeps every intermediate state, because the
 * screens need the shape of the journey and not only its destination.
 *
 * `rounds[0]` is the entry — there is no separate top-level entry field, since
 * an angel's first cheque is just the first round they wrote one into. Every
 * instrument (SAFE, CLA, priced equity) converts identically, at the round's
 * own valuation, so there is one formula for every cheque: `amount / post-money`.
 *
 * When the exit is inside the uncertain band, fees and returns are computed
 * twice, once against each bound, rather than against an invented midpoint.
 */

export interface RoundState {
  round: Round
  postMoneyCents: number
  ownershipBefore: number
  ownershipAfter: number
  /** What the angel actually put in at this round. */
  investedCents: number
  /** The entry fee on that cheque, paid on top of it. */
  entryFeeCents: number
  /** What holding the prior position through this round would have cost. */
  proRataCents: number
  stakeValueCents: number
}

export interface ScenarioResult {
  rounds: RoundState[]
  finalOwnership: number
  totalInvestedCents: number
  chequesCents: number[]
  exit: ExitProceeds
  feesLow: FeeResult
  feesHigh: FeeResult
  irrLow: number | undefined
  irrHigh: number | undefined
}

const whole = (cents: number): string => Math.round(cents / 100).toLocaleString('en-US')

function preMoneyOf(round: Round): number {
  if (round.valuationBasis === 'pre') return round.valuationCents
  if (round.valuationCents < round.raisedCents) {
    throw new RangeError(
      `${round.label}: a post-money valuation of ${whole(round.valuationCents)} is smaller than the ` +
        `${whole(round.raisedCents)} raised, so it cannot include the raise. Is it a pre-money valuation?`,
    )
  }
  return round.valuationCents - round.raisedCents
}

/** A round's terms. Exported so the UI can preview a counterfactual (sit out,
 * or pro-rata) without re-running the whole scenario. */
export function roundTerms(round: Round): RoundTerms {
  return {
    preMoney: preMoneyOf(round),
    raised: round.raisedCents,
    newOptionPool: round.newOptionPool,
  }
}

export function runScenario(scenario: Scenario): ScenarioResult {
  const ordered = [...scenario.rounds].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const first = ordered[0]
  if (first === undefined) {
    throw new RangeError('A scenario needs at least one round to invest into.')
  }

  const states: RoundState[] = []
  const cheques: ChequeCost[] = []
  const flows: CashFlow[] = []
  let ownership = 0

  for (const round of ordered) {
    const terms = roundTerms(round)
    const before = ownership
    const cheque = round.participation
    const invested = cheque?.amountCents ?? 0
    ownership = ownAfter(before, terms, invested)

    const entryFee = cheque !== undefined && invested > 0 ? entryFeeFor(invested, cheque.entryFee) : 0
    if (cheque !== undefined && invested > 0) {
      cheques.push({ chequeCents: invested, entryFeeCents: entryFee })
      flows.push({ date: round.date, amountCents: -invested })
    }

    states.push({
      round,
      postMoneyCents: postMoney(terms),
      ownershipBefore: before,
      ownershipAfter: ownership,
      investedCents: invested,
      entryFeeCents: entryFee,
      proRataCents: before > 0 ? proRata(before, terms) : 0,
      stakeValueCents: stakeValue(ownership, postMoney(terms)),
    })
  }

  const totalInvested = cheques.reduce((sum, c) => sum + c.chequeCents, 0)

  const exit = exitProceeds({
    valueCents: scenario.exit.valueCents,
    totalRaisedCents: scenario.exit.totalRaisedCents,
    ownership,
    investedCents: totalInvested,
    currency: scenario.currency,
  })

  const feesLow = applyFees(cheques, exit.lowCents, scenario.fees)
  const feesHigh = applyFees(cheques, exit.highCents, scenario.fees)

  const returnAt = (net: number): number | undefined =>
    irr([...flows, { date: scenario.exit.date, amountCents: net }])

  return {
    rounds: states,
    finalOwnership: ownership,
    totalInvestedCents: totalInvested,
    chequesCents: cheques.map((c) => c.chequeCents),
    exit,
    feesLow,
    feesHigh,
    irrLow: returnAt(feesLow.netCents),
    irrHigh: returnAt(feesHigh.netCents),
  }
}

export interface ExitOutcome {
  valueCents: number
  exit: ExitProceeds
  feesLow: FeeResult
  feesHigh: FeeResult
}

/**
 * The same deal sold at several prices, for a table of hypothetical exits. Each
 * row is a full run at that price, so a row can never disagree with what the
 * page shows when that price is the one selected.
 */
export function outcomesAt(scenario: Scenario, valuesCents: readonly number[]): ExitOutcome[] {
  return valuesCents.map((valueCents) => {
    const run = runScenario({ ...scenario, exit: { ...scenario.exit, valueCents } })
    return { valueCents, exit: run.exit, feesLow: run.feesLow, feesHigh: run.feesHigh }
  })
}
