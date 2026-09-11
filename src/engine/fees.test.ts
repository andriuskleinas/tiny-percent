import { describe, expect, it } from 'vitest'
import { toCents } from './money'
import { applyFees } from './fees'
import type { FeeTerms } from './fees'

const twoPercentOnTop: FeeTerms = {
  entry: { rule: 'percent', percent: 0.02, charged: 'on_top' },
  carry: { percent: 0.2, basis: 'per_deal' },
}

describe('golden case J — $50k in, 2% entry on top, 20% carry, $500k gross', () => {
  const result = applyFees(toCents(50_000), toCents(500_000), twoPercentOnTop)

  it('costs $51,000 out of pocket', () => {
    expect(result.outlayCents).toBe(toCents(51_000))
    expect(result.deployedCents).toBe(toCents(50_000))
  })

  it('takes $90,000 of carry on the profit', () => {
    expect(result.carryCents).toBe(toCents(90_000))
  })

  it('leaves $410,000 net', () => {
    expect(result.netCents).toBe(toCents(410_000))
  })

  it('turns a 10.00x gross into an 8.04x net', () => {
    expect(result.grossMultiple).toBeCloseTo(10, 9)
    expect(result.netMultiple).toBeCloseTo(410_000 / 51_000, 9)
  })

  it('accounts for every dollar of the $91,000 drag', () => {
    expect(result.dragCents).toBe(toCents(91_000))
    expect(result.entryFeeCents + result.carryCents + result.managementFeeCents).toBe(
      result.dragCents,
    )
  })
})

describe('where the entry fee lands changes the answer', () => {
  const deducted: FeeTerms = {
    ...twoPercentOnTop,
    entry: { rule: 'percent', percent: 0.02, charged: 'deducted' },
  }

  it('on top leaves the full cheque working and raises your outlay', () => {
    const r = applyFees(toCents(50_000), toCents(500_000), twoPercentOnTop)
    expect(r.deployedCents).toBe(toCents(50_000))
    expect(r.outlayCents).toBe(toCents(51_000))
  })

  it('deducted leaves less working and keeps your outlay at the cheque', () => {
    const r = applyFees(toCents(50_000), toCents(500_000), deducted)
    expect(r.deployedCents).toBe(toCents(49_000))
    expect(r.outlayCents).toBe(toCents(50_000))
  })
})

describe('the entry fee rules', () => {
  const gross = toCents(500_000)
  const cheque = toCents(50_000)

  it('charges a percentage', () => {
    const r = applyFees(cheque, gross, {
      entry: { rule: 'percent', percent: 0.02, charged: 'on_top' },
      carry: { percent: 0, basis: 'per_deal' },
    })
    expect(r.entryFeeCents).toBe(toCents(1_000))
  })

  it('charges a fixed minimum', () => {
    const r = applyFees(cheque, gross, {
      entry: { rule: 'fixed', fixedCents: toCents(2_500), charged: 'on_top' },
      carry: { percent: 0, basis: 'per_deal' },
    })
    expect(r.entryFeeCents).toBe(toCents(2_500))
  })

  it('charges the greater of the two, which is the common syndicate term', () => {
    const terms = {
      entry: {
        rule: 'greater_of' as const,
        percent: 0.02,
        fixedCents: toCents(2_500),
        charged: 'on_top' as const,
      },
      carry: { percent: 0, basis: 'per_deal' as const },
    }
    expect(applyFees(cheque, gross, terms).entryFeeCents).toBe(toCents(2_500))
    expect(applyFees(toCents(500_000), gross, terms).entryFeeCents).toBe(toCents(10_000))
  })
})

describe('management fee', () => {
  const withManagement = (source: 'capital' | 'invoiced'): FeeTerms => ({
    entry: { rule: 'percent', percent: 0, charged: 'on_top' },
    management: { annualPercent: 0.02, years: 10, source },
    carry: { percent: 0, basis: 'per_deal' },
  })

  it('drawn from capital leaves less invested', () => {
    const r = applyFees(toCents(50_000), toCents(500_000), withManagement('capital'))
    expect(r.managementFeeCents).toBe(toCents(10_000))
    expect(r.deployedCents).toBe(toCents(40_000))
    expect(r.outlayCents).toBe(toCents(50_000))
  })

  it('invoiced separately raises what you paid', () => {
    const r = applyFees(toCents(50_000), toCents(500_000), withManagement('invoiced'))
    expect(r.deployedCents).toBe(toCents(50_000))
    expect(r.outlayCents).toBe(toCents(60_000))
  })
})

describe('carry', () => {
  it('takes nothing when the deal loses money', () => {
    const r = applyFees(toCents(50_000), toCents(30_000), twoPercentOnTop)
    expect(r.carryCents).toBe(0)
    expect(r.netCents).toBe(toCents(30_000))
  })

  it('takes nothing at exactly break-even', () => {
    expect(applyFees(toCents(50_000), toCents(50_000), twoPercentOnTop).carryCents).toBe(0)
  })

  it('waits for a hurdle when one is set', () => {
    const withHurdle: FeeTerms = {
      ...twoPercentOnTop,
      carry: { percent: 0.2, hurdlePercent: 0.5, basis: 'per_deal' },
    }
    // A 50% preferred return means no carry until $75,000 comes back.
    expect(applyFees(toCents(50_000), toCents(70_000), withHurdle).carryCents).toBe(0)
    expect(applyFees(toCents(50_000), toCents(100_000), withHurdle).carryCents).toBe(
      toCents(5_000),
    )
  })

  it('is charged on what was deployed, not on what you paid in fees', () => {
    const r = applyFees(toCents(50_000), toCents(500_000), twoPercentOnTop)
    expect(r.carryCents).toBe(Math.round(0.2 * (toCents(500_000) - r.deployedCents)))
  })
})
