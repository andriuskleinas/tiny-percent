import { applyFees, entryFeeFor } from './fees'
import type { FeeResult } from './fees'
import { exitProceeds } from './exit'
import type { ExitProceeds } from './exit'
import { accrue, convert, matures, yearsBetween } from './instrument'
import type { Conversion, ConvertibleInput } from './instrument'
import { irr } from './irr'
import type { CashFlow } from './irr'
import { ownAfter, postMoney, proRata, stakeValue } from './ownership'
import type { RoundTerms } from './ownership'
import type { Round, Scenario } from './types'

/**
 * Runs a whole scenario and keeps every intermediate state, because the screens
 * need the shape of the journey and not only its destination.
 *
 * Two modelling decisions worth stating plainly. The entry instrument lands in
 * the first round, which is what actually happens — a SAFE converts at the first
 * priced round, and you would not list rounds you invested before. And when the
 * exit is inside the uncertain band, fees and returns are computed twice, once
 * against each bound, rather than against an invented midpoint.
 */

export interface RoundState {
  round: Round
  postMoneyCents: number
  ownershipBefore: number
  ownershipAfter: number
  /** What the angel actually put in at this round. */
  investedCents: number
  /** What holding the prior position through this round would have cost. */
  proRataCents: number
  stakeValueCents: number
  /** Present only on the round where the entry instrument converted. */
  conversion?: Conversion | undefined
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

function termsOf(round: Round): RoundTerms {
  return {
    preMoney: round.preMoneyCents,
    raised: round.raisedCents,
    newOptionPool: round.newOptionPool,
  }
}

function yearsHeld(from: string, to: string): number {
  return Date.parse(to) < Date.parse(from) ? 0 : yearsBetween(from, to)
}

export function runScenario(scenario: Scenario): ScenarioResult {
  const ordered = [...scenario.rounds].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const first = ordered[0]
  if (first === undefined) {
    throw new RangeError('A scenario needs at least one round to invest into.')
  }

  // A loan the angel chose not to convert never becomes equity. It stays debt,
  // accrues to the exit, and is repaid ahead of every shareholder.
  const held = scenario.entry
  const staysDebt =
    matures(held.type) &&
    (scenario.exit.unconvertedLoan === 'repay' || scenario.exit.unconvertedLoan === 'extend')

  const convertsAt = ordered.find((r) => r.convertsHere) ?? first

  const states: RoundState[] = []
  const cheques: number[] = []
  const flows: CashFlow[] = []
  let ownership = 0

  // A loan that is never converted still cost the angel the money. It buys no
  // equity, but it is capital deployed and it has to be in the return figures.
  if (staysDebt) {
    cheques.push(held.amountCents)
    const onTop =
      scenario.fees.entry.charged === 'on_top'
        ? entryFeeFor(held.amountCents, scenario.fees.entry)
        : 0
    flows.push({ date: held.date, amountCents: -(held.amountCents + onTop) })
  }

  for (const round of ordered) {
    const terms = termsOf(round)
    const before = ownership
    const holdCost = before > 0 ? proRata(before, terms) : 0

    let conversion: Conversion | undefined
    let invested = 0

    if (!staysDebt && round.id === convertsAt.id) {
      const input: ConvertibleInput = {
        type: held.type,
        amountCents: held.amountCents,
        capCents: held.capCents,
        discount: held.discount,
        interestRate: held.interestRate,
        interestMode: held.interestMode,
        years: yearsHeld(held.date, round.date),
        otherConvertingCents: held.otherConvertingCents,
      }
      conversion = convert(input, terms)
      invested = conversion.investedCents
      ownership = ownAfter(before, terms) + conversion.ownership
    } else {
      const action = round.angelAction
      invested =
        action.kind === 'pro_rata' ? holdCost : action.kind === 'custom' ? action.amountCents : 0
      ownership = ownAfter(before, terms, invested)
    }

    if (invested > 0) {
      cheques.push(invested)
      const onTop = scenario.fees.entry.charged === 'on_top' ? entryFeeFor(invested, scenario.fees.entry) : 0
      flows.push({ date: round.date, amountCents: -(invested + onTop) })
    }

    states.push({
      round,
      postMoneyCents: postMoney(terms),
      ownershipBefore: before,
      ownershipAfter: ownership,
      investedCents: invested,
      proRataCents: holdCost,
      stakeValueCents: stakeValue(ownership, postMoney(terms)),
      conversion,
    })
  }

  const totalInvested = cheques.reduce((sum, c) => sum + c, 0)

  // Management fees invoiced separately are treated as paid up front. That is
  // slightly harsh on the rate of return, since in reality they are spread.
  const management = scenario.fees.management
  if (management?.source === 'invoiced') {
    flows.push({
      date: first.date,
      amountCents: -Math.round(totalInvested * management.annualPercent * management.years),
    })
  }

  const owed = staysDebt
    ? accrue(
        held.amountCents,
        held.interestRate ?? 0,
        yearsHeld(held.date, scenario.exit.date),
        held.interestMode ?? 'simple',
      )
    : undefined

  const exit = exitProceeds({
    valueCents: scenario.exit.valueCents,
    totalRaisedCents: scenario.exit.totalRaisedCents,
    ownership,
    investedCents: totalInvested,
    unconvertedLoanOwedCents: owed,
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
    chequesCents: cheques,
    exit,
    feesLow,
    feesHigh,
    irrLow: returnAt(feesLow.netCents),
    irrHigh: returnAt(feesHigh.netCents),
  }
}
