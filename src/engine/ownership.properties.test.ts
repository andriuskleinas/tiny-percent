import { describe, expect, it } from 'vitest'
import { toCents } from './money'
import { PoolTooLargeError, ownAfter, postMoney, proRata, followOnBreakEven } from './ownership'
import type { RoundTerms } from './ownership'

/**
 * Properties that must hold for every input, not just the worked examples.
 * Seeded so a failure is reproducible: the seed is printed with the case.
 */

const RUNS = 10_000
const SEED = 0x5eed

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Case {
  terms: RoundTerms
  ownBefore: number
  invested: number
}

function cases(): Case[] {
  const rnd = mulberry32(SEED)
  const out: Case[] = []
  for (let i = 0; i < RUNS; i += 1) {
    // $100k to $500M pre-money, a raise between 1% and 200% of it.
    const preMoney = toCents(100_000 + rnd() * 500_000_000)
    const raised = toCents(Math.max(1000, (0.01 + rnd() * 1.99) * (preMoney / 100)))
    const limit = preMoney / (preMoney + raised)
    // A pool a quarter of the time, always strictly inside the limit.
    const pool = rnd() < 0.25 ? rnd() * limit * 0.98 : 0
    const terms: RoundTerms = pool > 0 ? { preMoney, raised, newOptionPool: pool } : { preMoney, raised }
    out.push({
      terms,
      ownBefore: rnd(),
      // You cannot put in more than the round raised.
      invested: Math.round(rnd() * raised),
    })
  }
  return out
}

const ALL = cases()

function describeCase(c: Case): string {
  return `seed ${SEED}: pre=${c.terms.preMoney} raised=${c.terms.raised} pool=${c.terms.newOptionPool ?? 0} own=${c.ownBefore} invested=${c.invested}`
}

describe(`ownership properties over ${RUNS} seeded scenarios`, () => {
  it('ownership always lands between zero and one', () => {
    for (const c of ALL) {
      const after = ownAfter(c.ownBefore, c.terms, c.invested)
      if (after < 0 || after > 1 + 1e-12) throw new Error(`${after} — ${describeCase(c)}`)
    }
  })

  it('sitting out never increases ownership', () => {
    for (const c of ALL) {
      const after = ownAfter(c.ownBefore, c.terms)
      if (after > c.ownBefore + 1e-12) throw new Error(`${after} > ${c.ownBefore} — ${describeCase(c)}`)
    }
  })

  it('a pro-rata cheque returns exactly the prior ownership', () => {
    for (const c of ALL) {
      const cheque = proRata(c.ownBefore, c.terms)
      const after = ownAfter(c.ownBefore, c.terms, cheque)
      // The cheque is rounded to a whole cent, so ownership can land half a
      // cent's worth either side. Nothing beyond that is acceptable.
      const tolerance = 1 / postMoney(c.terms) + 1e-12
      if (Math.abs(after - c.ownBefore) > tolerance) {
        throw new Error(`off by ${after - c.ownBefore} — ${describeCase(c)}`)
      }
    }
  })

  it('the break-even is exactly the post-money that was paid', () => {
    for (const c of ALL) {
      if (c.invested <= 0) continue
      const breakEven = followOnBreakEven(c.terms, c.invested)
      if (breakEven !== postMoney(c.terms)) {
        throw new Error(`${breakEven} != ${postMoney(c.terms)} — ${describeCase(c)}`)
      }
    }
  })

  it('a pool at or above the pre-money fraction always throws', () => {
    for (const c of ALL.slice(0, 500)) {
      const limit = c.terms.preMoney / postMoney(c.terms)
      expect(() => ownAfter(c.ownBefore, { ...c.terms, newOptionPool: limit })).toThrow(
        PoolTooLargeError,
      )
    }
  })
})
