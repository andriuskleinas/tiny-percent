import { roundCents } from './money'

/**
 * Syndicate economics. Two choices here change the answer more than people
 * expect, so neither is assumed: whether the entry fee comes out of the cheque
 * or sits on top of it, and whether carry is charged before or after a hurdle.
 */

export interface EntryFeeTerms {
  rule: 'percent' | 'fixed' | 'greater_of'
  percent?: number | undefined
  fixedCents?: number | undefined
  /** On top raises your outlay; deducted leaves less of your cheque working. */
  charged: 'on_top' | 'deducted'
}

export interface ManagementFeeTerms {
  annualPercent: number
  years: number
  /** From capital leaves less invested; invoiced raises what you paid. */
  source: 'capital' | 'invoiced'
}

export interface CarryTerms {
  percent: number
  /**
   * A simple preferred return on deployed capital, as a fraction. Carry applies
   * only to proceeds above `deployed * (1 + hurdlePercent)`.
   */
  hurdlePercent?: number | undefined
  /**
   * Per-deal, with no netting across a portfolio. That is the syndicate norm and
   * it is worse for the investor than fund-level carry, so it is the default.
   */
  basis: 'per_deal'
}

export interface FeeTerms {
  entry: EntryFeeTerms
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

/** The entry fee on a single cheque. Exported so a timeline can cost each one. */
export function entryFeeFor(chequeCents: number, terms: EntryFeeTerms): number {
  const byPercent = roundCents(chequeCents * (terms.percent ?? 0))
  const fixed = terms.fixedCents ?? 0
  if (terms.rule === 'percent') return byPercent
  if (terms.rule === 'fixed') return fixed
  return Math.max(byPercent, fixed)
}

/**
 * `cheques` is one cheque or several. Syndicates charge the entry fee per deal,
 * so a follow-on pays it again; the management fee and carry are charged once
 * across the total.
 */
export function applyFees(
  cheques: number | number[],
  grossProceedsCents: number,
  terms: FeeTerms,
): FeeResult {
  const all = Array.isArray(cheques) ? cheques : [cheques]
  const chequeCents = all.reduce((sum, c) => sum + c, 0)
  const entry = all.reduce((sum, c) => sum + entryFeeFor(c, terms.entry), 0)
  const management = terms.management
    ? roundCents(chequeCents * terms.management.annualPercent * terms.management.years)
    : 0

  const fromCapital = terms.management?.source === 'capital' ? management : 0
  const invoiced = management - fromCapital
  const deployed = chequeCents - (terms.entry.charged === 'deducted' ? entry : 0) - fromCapital
  const outlay = chequeCents + (terms.entry.charged === 'on_top' ? entry : 0) + invoiced

  // Carry is charged on deployed capital, never on the fees you also paid.
  const hurdleFloor = deployed * (1 + (terms.carry.hurdlePercent ?? 0))
  const carryBase = Math.max(0, grossProceedsCents - hurdleFloor)
  const carry = roundCents(carryBase * terms.carry.percent)
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
