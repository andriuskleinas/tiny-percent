import { describe, expect, it } from 'vitest'
import { toCents } from './money'
import { applyFees, entryFeeFor } from './fees'
import type { ChequeCost, FeeTerms } from './fees'

const cheque = (chequeCents: number, entryFeeCents = 0): ChequeCost => ({ chequeCents, entryFeeCents })

const twentyPercentCarry: FeeTerms = {
  carry: { percent: 0.2, basis: 'per_deal' },
}

describe('golden case J — $50k in, $1,000 entry fee, 20% carry, $500k gross', () => {
  const result = applyFees([cheque(toCents(50_000), toCents(1_000))], toCents(500_000), twentyPercentCarry)

  it('deploys $49,000 after the entry fee', () => {
    expect(result.deployedCents).toBe(toCents(49_000))
    expect(result.outlayCents).toBe(toCents(50_000))
  })

  it('takes carry on the profit above what was deployed', () => {
    expect(result.carryCents).toBe(Math.round(0.2 * (toCents(500_000) - toCents(49_000))))
  })

  it('accounts for every dollar of drag', () => {
    expect(result.entryFeeCents + result.carryCents + result.managementFeeCents).toBe(result.dragCents)
  })
})

describe('the entry fee rules', () => {
  const gross = toCents(500_000)
  const chequeCents = toCents(50_000)

  it('charges a percentage', () => {
    expect(entryFeeFor(chequeCents, { rule: 'percent', percent: 0.02 })).toBe(toCents(1_000))
  })

  it('charges a fixed minimum', () => {
    expect(entryFeeFor(chequeCents, { rule: 'fixed', fixedCents: toCents(2_500) })).toBe(toCents(2_500))
  })

  it('charges the greater of the two, which is the common syndicate term', () => {
    const terms = { rule: 'greater_of' as const, percent: 0.02, fixedCents: toCents(2_500) }
    expect(entryFeeFor(chequeCents, terms)).toBe(toCents(2_500))
    expect(entryFeeFor(toCents(500_000), terms)).toBe(toCents(10_000))
  })

  it('is charged per cheque, so a follow-on pays it again', () => {
    const terms = { rule: 'percent' as const, percent: 0.02 }
    const result = applyFees(
      [cheque(chequeCents, entryFeeFor(chequeCents, terms)), cheque(chequeCents, entryFeeFor(chequeCents, terms))],
      gross,
      twentyPercentCarry,
    )
    expect(result.entryFeeCents).toBe(toCents(2_000))
  })
})

describe('management fee', () => {
  const withManagement: FeeTerms = {
    management: { annualPercent: 0.02, years: 10 },
    carry: { percent: 0, basis: 'per_deal' },
  }

  it('is drawn from capital, reducing what was deployed', () => {
    const r = applyFees([cheque(toCents(50_000))], toCents(500_000), withManagement)
    expect(r.managementFeeCents).toBe(toCents(10_000))
    expect(r.deployedCents).toBe(toCents(40_000))
    expect(r.outlayCents).toBe(toCents(50_000))
  })
})

describe('carry', () => {
  it('takes nothing when the deal loses money', () => {
    const r = applyFees([cheque(toCents(50_000))], toCents(30_000), twentyPercentCarry)
    expect(r.carryCents).toBe(0)
    expect(r.netCents).toBe(toCents(30_000))
  })

  it('takes nothing at exactly break-even', () => {
    expect(applyFees([cheque(toCents(50_000))], toCents(50_000), twentyPercentCarry).carryCents).toBe(0)
  })

  it('is charged on what was deployed, not on what you paid in fees', () => {
    const r = applyFees([cheque(toCents(50_000), toCents(1_000))], toCents(500_000), twentyPercentCarry)
    expect(r.carryCents).toBe(Math.round(0.2 * (toCents(500_000) - r.deployedCents)))
  })
})
