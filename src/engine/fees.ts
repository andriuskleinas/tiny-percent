import { roundCents } from './money'

/**
 * Syndicate economics, kept deliberately simple: an entry fee charged on each
 * cheque, a management fee charged once against total capital, and carry on
 * the profit above what was deployed.
 */

export interface EntryFeeTerms {
  /** Fixed amount / percentage of the cheque / percentage with a fixed floor. */
  rule: 'percent' | 'fixed' | 'greater_of'
  percent?: number | undefined
  fixedCents?: number | undefined
}

export interface ManagementFeeTerms {
  annualPercent: number
  years: number
}

export interface CarryTerms {
  percent: number
  /**
   * Per-deal, with no netting across a portfolio. That is the syndicate norm and
   * it is worse for the investor than fund-level carry, so it is the default.
   */
  basis: 'per_deal'
}

export interface FeeTerms {
  management?: ManagementFeeTerms | undefined
  carry: CarryTerms
}

export interface FeeResult {
  entryFeeCents: number
  managementFeeCents: number
  carryCents: number
  /** Every dollar that did not reach you. */
  dragCents: number
  /** What actually bought equity. */
  deployedCents: number
  /** What left your bank account. */
  outlayCents: number
  netCents: number
  grossMultiple: number
  netMultiple: number
}

/** The entry fee on a single cheque. */
export function entryFeeFor(chequeCents: number, terms: EntryFeeTerms): number {
  const byPercent = roundCents(chequeCents * (terms.percent ?? 0))
  const fixed = terms.fixedCents ?? 0
  if (terms.rule === 'percent') return byPercent
  if (terms.rule === 'fixed') return fixed
  return Math.max(byPercent, fixed)
}

export interface ChequeCost {
  chequeCents: number
  entryFeeCents: number
}

/**
 * Entry fee is charged per cheque and already carried on each `ChequeCost`, so
 * a follow-on pays it again; the management fee and carry are charged once
 * across the total. The entry fee always comes out of the cheque, and the
 * management fee always reduces deployed capital — a syndicate's other choices
 * here are not modelled.
 */
export function applyFees(
  cheques: ChequeCost[],
  grossProceedsCents: number,
  terms: FeeTerms,
): FeeResult {
  const chequeCents = cheques.reduce((sum, c) => sum + c.chequeCents, 0)
  const entry = cheques.reduce((sum, c) => sum + c.entryFeeCents, 0)
  const management = terms.management
    ? roundCents(chequeCents * terms.management.annualPercent * terms.management.years)
    : 0

  const deployed = chequeCents - entry - management
  const outlay = chequeCents

  const carry = roundCents(Math.max(0, grossProceedsCents - deployed) * terms.carry.percent)
  const net = grossProceedsCents - carry

  return {
    entryFeeCents: entry,
    managementFeeCents: management,
    carryCents: carry,
    dragCents: entry + management + carry,
    deployedCents: deployed,
    outlayCents: outlay,
    netCents: net,
    grossMultiple: deployed > 0 ? grossProceedsCents / deployed : 0,
    netMultiple: outlay > 0 ? net / outlay : 0,
  }
}
