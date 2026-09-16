import { postMoney } from '../engine/ownership'
import { roundTerms } from '../engine/scenario'
import type { Round } from '../engine/types'

/**
 * Small questions the panels ask about a scenario. Kept out of the component
 * files so fast refresh keeps working on them.
 */

/** Nothing to show until there is a cheque and a company to price it against. */
export function entryIsComplete(round: Round): boolean {
  return (round.participation?.amountCents ?? 0) > 0 && postMoney(roundTerms(round)) > 0
}
