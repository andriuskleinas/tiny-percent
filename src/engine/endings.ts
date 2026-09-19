import { outcomesAt } from './scenario'
import type { ExitOutcome, ScenarioResult } from './scenario'
import type { Scenario } from './types'

/**
 * Four ways a deal can end, side by side: the company fails, sells for exactly
 * what it raised, or grows 10× or 100× from the valuation you invested at. Most
 * startups end in the first two, and the last pays for the rest, so a single
 * exit on a slider hides the most important fact about angel investing.
 *
 * "Grows 10×" is the company's multiple, measured from the entry round's
 * post-money (for a SAFE or note, its cap as a post-money figure). What reaches
 * you is less, after dilution, the preference stack and carry. Each ending is a
 * full engine run through `outcomesAt`, so it can never disagree with the exit
 * slider set to the same price. Golden case Q holds it to the oracle.
 */

export type EndingKind = 'fails' | 'capital' | 'grows10' | 'grows100'

export interface Ending {
  kind: EndingKind
  valueCents: number
  outcome: ExitOutcome
}

export interface Endings {
  rows: Ending[]
  /** The valuation the growth multiples are measured from. */
  entryPostCents: number
  /**
   * How many other cheques like this one, all failing, one such win pays back:
   * the floor of its net multiple, minus this cheque. Taken from the low end of
   * a range so it never overstates. Never below 0.
   */
  covers: { grows10: number; grows100: number }
}

// A multiple of exactly 2 can come out as 1.9999999; that still pays back two cheques.
const EPSILON = 1e-9

function covered(outcome: ExitOutcome | undefined): number {
  if (!outcome) return 0
  return Math.max(0, Math.floor(outcome.feesLow.netMultiple + EPSILON) - 1)
}

/** The four endings, or undefined while there is no priced cheque to end. */
export function endings(scenario: Scenario, run: ScenarioResult): Endings | undefined {
  const entryId = scenario.rounds[0]?.id
  const entryPostCents = run.rounds.find((r) => r.round.id === entryId)?.postMoneyCents ?? 0
  if (!(run.totalInvestedCents > 0) || !(entryPostCents > 0)) return undefined

  const kinds: Array<[EndingKind, number]> = [
    ['fails', 0],
    ['capital', scenario.exit.totalRaisedCents],
    ['grows10', entryPostCents * 10],
    ['grows100', entryPostCents * 100],
  ]
  const outcomes = outcomesAt(scenario, kinds.map(([, value]) => value))
  const rows = kinds.map(([kind, valueCents], i) => ({ kind, valueCents, outcome: outcomes[i] as ExitOutcome }))
  return {
    rows,
    entryPostCents,
    covers: {
      grows10: covered(rows[2]?.outcome),
      grows100: covered(rows[3]?.outcome),
    },
  }
}
