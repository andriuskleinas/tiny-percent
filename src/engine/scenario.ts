import { convertAt, isConvertible, maturityOf } from './convert'
import type { Conversion, Maturity } from './convert'
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
 * an angel's first cheque is just the first round they wrote one into. A priced
 * cheque buys `amount / post-money`. A SAFE or note entry shows its stake at the
 * cap until the next round, where it converts (see `convert.ts`); if no round
 * follows, the stake at the cap is the answer and the result says so. A note
 * whose maturity date comes first settles there instead: repaid in cash, or
 * converted and diluted by every round after.
 *
 * When the exit is inside the uncertain band, fees and returns are computed
 * twice, once against each bound, rather than against an invented midpoint.
 */

export interface RoundState {
  round: Round
  postMoneyCents: number
  ownershipBefore: number
  /**
   * The stake this round's new money dilutes and a cheque adds to. Equal to
   * `ownershipBefore` except where a SAFE or note converts, when it is the
   * converted stake rather than the stake at the cap.
   */
  heldBefore: number
  ownershipAfter: number
  /** Present on the round where the entry SAFE or note converts. */
  conversion?: Conversion | undefined
  /** What the angel actually put in at this round. */
  investedCents: number
  /** The entry fee on that cheque, paid on top of it. */
  entryFeeCents: number
  /** What holding the prior position through this round would have cost. */
  proRataCents: number
  stakeValueCents: number
}

/**
 * How the entry cheque stands: priced shares, a SAFE or note that has converted,
 * or one still waiting for a priced round.
 */
export interface EntryStatus {
  /** `converted` covers a note converting at maturity as well as at a round. */
  kind: 'priced' | 'converted' | 'pending' | 'repaid'
  /** A pre-money cap, whose answer depends on SAFEs the angel cannot see. */
  estimate: boolean
}

export interface ScenarioResult {
  entry: EntryStatus
  rounds: RoundState[]
  /** Present when a note reached its maturity date before any priced round. */
  maturity?: Maturity | undefined
  finalOwnership: number
  totalInvestedCents: number
  chequesCents: number[]
  /**
   * What the shares bring at the exit. A repaid note's cash is not in here, as
   * it arrived at maturity; it is in `maturity`, and in the fees and returns.
   */
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
  // The entry is `rounds[0]` by definition, which is not always the earliest
  // date: a round can be added before it. A SAFE or note converts in the
  // round dated next after the entry.
  const entryRound = scenario.rounds[0] ?? first
  const entryIndex = ordered.indexOf(entryRound)
  const entryCheque = entryRound.participation
  const convertible = entryCheque !== undefined && isConvertible(entryCheque.type) && entryCheque.amountCents > 0
  const maturity = convertible ? maturityOf(entryRound, entryCheque, ordered[entryIndex + 1], scenario.exit.date) : undefined

  for (const [index, round] of ordered.entries()) {
    const terms = roundTerms(round)
    const before = ownership
    const next = index === entryIndex + 1
    const conversion = convertible && next && !maturity ? convertAt(entryRound, entryCheque, round, terms) : undefined
    const held = conversion?.stake ?? (maturity && next ? maturity.stake : before)
    const cheque = round.participation
    const invested = cheque?.amountCents ?? 0
    ownership = ownAfter(held, terms, invested)

    const entryFee = cheque !== undefined && invested > 0 ? entryFeeFor(invested, cheque.entryFee) : 0
    if (cheque !== undefined && invested > 0) {
      cheques.push({ chequeCents: invested, entryFeeCents: entryFee })
      flows.push({ date: round.date, amountCents: -invested })
    }

    states.push({
      round,
      postMoneyCents: postMoney(terms),
      ownershipBefore: before,
      heldBefore: held,
      ownershipAfter: ownership,
      conversion,
      investedCents: invested,
      entryFeeCents: entryFee,
      proRataCents: held > 0 ? proRata(held, terms) : 0,
      stakeValueCents: stakeValue(ownership, postMoney(terms)),
    })
  }

  // Maturity with no round after it: the stake at the cap gives way to the settlement.
  if (maturity && entryIndex === ordered.length - 1) ownership = maturity.stake

  const totalInvested = cheques.reduce((sum, c) => sum + c.chequeCents, 0)
  const repaid = maturity?.outcome === 'repay' ? maturity : undefined

  const exit = exitProceeds({
    valueCents: scenario.exit.valueCents,
    totalRaisedCents: scenario.exit.totalRaisedCents,
    ownership,
    // A repaid note has left the preference stack; only cheques held as shares sit in it.
    investedCents: totalInvested - (repaid ? repaid.repaidCents - repaid.accruedCents : 0),
    currency: scenario.currency,
  })

  const repaidCents = repaid?.repaidCents ?? 0
  const feesLow = applyFees(cheques, exit.lowCents + repaidCents, scenario.fees)
  const feesHigh = applyFees(cheques, exit.highCents + repaidCents, scenario.fees)

  // Carry comes out of the first money back: the repayment arrives net of as
  // much of it as it can bear, and the exit brings the rest.
  const returnAt = (net: number): number | undefined => {
    const atMaturity = Math.min(repaidCents, net)
    const back = repaid ? [{ date: repaid.date, amountCents: atMaturity }] : []
    return irr([...flows, ...back, { date: scenario.exit.date, amountCents: net - atMaturity }])
  }

  const entry: EntryStatus = {
    kind: !convertible ? 'priced' : repaid ? 'repaid' : maturity || entryIndex + 1 < ordered.length ? 'converted' : 'pending',
    estimate: convertible && !repaid && entryRound.valuationBasis === 'pre',
  }

  return {
    entry,
    maturity,
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
