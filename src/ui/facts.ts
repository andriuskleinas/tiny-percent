import { postMoney } from '../engine/ownership'
import { roundTerms } from '../engine/scenario'
import type { Instrument, Round, Scenario } from '../engine/types'

/**
 * Small questions the panels ask about a scenario. Kept out of the component
 * files so fast refresh keeps working on them.
 */

export const EXIT_DISCLAIMER =
  'Exit calculations are hypothetical scenarios based on the assumptions entered and are not predictions of future investment performance.'

/** Nothing to show until there is a cheque and a company to price it against. */
export function entryIsComplete(round: Round): boolean {
  return (round.participation?.amountCents ?? 0) > 0 && postMoney(roundTerms(round)) > 0
}

export function hasEntryFee(cheque: Instrument | undefined): boolean {
  return (cheque?.entryFee.percent ?? 0) > 0 || (cheque?.entryFee.fixedCents ?? 0) > 0
}

/** Carry or a management fee: the syndicate terms that apply to the whole deal. */
export function hasFees(scenario: Scenario): boolean {
  return scenario.fees.carry.percent > 0 || scenario.fees.management !== undefined
}
