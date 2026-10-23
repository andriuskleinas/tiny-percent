import { isConvertible } from '../engine/convert'
import type { Maturity } from '../engine/convert'
import { postMoney } from '../engine/ownership'
import { roundTerms } from '../engine/scenario'
import type { RoundState } from '../engine/scenario'
import type { Instrument, Round } from '../engine/types'
import { conversionRoute, instrumentName } from './format'

/**
 * Small questions the panels ask about a scenario. Kept out of the component
 * files so fast refresh keeps working on them.
 */

/** Nothing to show until there is a cheque and a company to price it against. */
export function entryIsComplete(round: Round): boolean {
  return (round.participation?.amountCents ?? 0) > 0 && postMoney(roundTerms(round)) > 0
}

/** The rounds worth a row in a stake table: ones you hold through or wrote a cheque into. */
export function stakeRows(states: RoundState[]): RoundState[] {
  return states.filter((s) => s.ownershipAfter > 0 || s.investedCents > 0)
}

function entryChequeOf(states: RoundState[]): Instrument | undefined {
  return stakeRows(states).find((s) => s.ownershipBefore === 0 && s.investedCents > 0)?.round.participation
}

/** The entry cheque when it is a SAFE or note, which a stake table shows at its cap until it converts. */
export function convertibleEntryOf(states: RoundState[]): Instrument | undefined {
  const cheque = entryChequeOf(states)
  return cheque && isConvertible(cheque.type) ? cheque : undefined
}

/**
 * The note a stake table puts under a round's name when the entry is a SAFE or
 * note: its first row is a stake at the cap, and the round after it is where
 * the stake is actually fixed, by converting or by maturing first.
 */
export function stakeNotes(states: RoundState[], maturity?: Maturity | undefined): (s: RoundState) => string | undefined {
  const entryCheque = entryChequeOf(states)
  const convertibleEntry = convertibleEntryOf(states)
  const afterEntry = states[states.findIndex((s) => s.round.participation === entryCheque) + 1]
  return (s) => {
    if (!convertibleEntry) return undefined
    const name = capitalised(instrumentName(convertibleEntry.type))
    if (s.conversion) return `${name} converts at ${conversionRoute(s.conversion.route, convertibleEntry.discount)}`
    if (maturity && s === afterEntry) return maturity.outcome === 'repay' ? 'Note repaid at maturity' : 'Note converted at maturity'
    if (s.ownershipBefore === 0 && s.round.participation === convertibleEntry) return `${name}, at the cap`
    return undefined
  }
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
