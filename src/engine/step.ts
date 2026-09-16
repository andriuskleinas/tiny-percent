import { roundCents } from './money'
import { postMoney } from './ownership'
import { roundTerms } from './scenario'
import type { Round, Scenario } from './types'

/**
 * A round described the way people talk about it: "the valuation tripled and
 * they sold a fifth of the company". It is only another view of the same two
 * stored numbers, post-money and amount raised, so the growth and share-sold
 * sliders and the exact fields can never disagree.
 *
 * It also answers the question an angel most needs answered about a round they
 * sit out. The stake is worth `pre-money net of the pool / previous post-money`
 * afterwards, which is `growth × (1 − sold − pool)`: the new price per share over
 * the old one. A company that grows ×1.25 while selling 25% has raised an "up
 * round" and still made every existing holder poorer. Golden case N holds this
 * to the share ledger.
 */

export interface Step {
  /** Post-money over the previous round's post-money. */
  growth: number
  /** Share of the company sold in this round: raised over post-money. */
  sold: number
  /** New option pool, as a fraction of post-money. 0 when there is none. */
  pool: number
  /** What a stake that sits this round out is worth after it, per unit before. */
  stakeFactor: number
}

/** The step a stored round represents, or undefined while there is nothing to measure. */
export function stepFromRound(prevPostCents: number, round: Round): Step | undefined {
  if (!(prevPostCents > 0)) return undefined
  if (round.valuationBasis === 'post' && round.valuationCents < round.raisedCents) return undefined
  const terms = roundTerms(round)
  const post = postMoney(terms)
  if (!(post > 0)) return undefined
  const pool = terms.newOptionPool ?? 0
  return {
    growth: post / prevPostCents,
    sold: terms.raised / post,
    pool,
    stakeFactor: (terms.preMoney - pool * post) / prevPostCents,
  }
}

/** The stored fields for a step. Always written as post-money, which is what a step measures. */
export function roundFromStep(
  prevPostCents: number,
  growth: number,
  sold: number,
): { valuationCents: number; raisedCents: number; valuationBasis: 'post' } {
  if (!(prevPostCents > 0)) throw new RangeError('A step needs the previous round’s valuation to grow from.')
  if (!(growth > 0) || !Number.isFinite(growth)) throw new RangeError('The valuation has to be multiplied by more than zero.')
  if (!(sold >= 0 && sold < 1)) throw new RangeError('A round can sell from 0% up to, but not including, 100% of the company.')
  const valuationCents = roundCents(prevPostCents * growth)
  return { valuationCents, raisedCents: roundCents(valuationCents * sold), valuationBasis: 'post' }
}

/**
 * The post-money of the round dated just before this one, which is what its
 * growth is measured from. Undefined for the earliest round, an unknown id, or
 * a previous round that cannot be priced.
 */
export function previousPostMoney(scenario: Pick<Scenario, 'rounds'>, id: string): number | undefined {
  const ordered = [...scenario.rounds].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const index = ordered.findIndex((r) => r.id === id)
  const prev = index > 0 ? ordered[index - 1] : undefined
  if (!prev) return undefined
  if (prev.valuationBasis === 'post' && prev.valuationCents < prev.raisedCents) return undefined
  const post = postMoney(roundTerms(prev))
  return post > 0 ? post : undefined
}
