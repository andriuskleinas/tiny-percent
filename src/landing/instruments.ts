import { conversionRoutes } from '../engine/convert'
import type { ConversionRoute } from '../engine/convert'
import { toCents } from '../engine/money'
import { roundTerms, runScenario } from '../engine/scenario'
import type { InstrumentType, Round, Scenario } from '../engine/types'

/**
 * Every number "Shares, SAFE or convertible note?" quotes. One cheque at one
 * valuation, invested three ways, then the same next round, so the only thing
 * that differs between the three is the instrument. Each figure is a full
 * engine run; nothing is typed into the copy.
 *
 * The dates span exactly two years with no leap day, so the note's interest is
 * the round 8% × 2 the explanation shows.
 */

const CHEQUE = toCents(25_000)
const CAP = toCents(5_000_000)
const DISCOUNT = 0.2
const INTEREST = 0.08
const NO_FEE = { rule: 'percent' as const, percent: 0 }

const SEED: Round = {
  id: 'seed',
  label: 'Seed',
  date: '2027-01-01',
  valuationCents: toCents(8_000_000),
  valuationBasis: 'pre',
  raisedCents: toCents(2_000_000),
}

/** The same Seed, priced below the cap: €3M pre-money raising €1M. */
const CHEAP_SEED: Round = { ...SEED, valuationCents: toCents(3_000_000), raisedCents: toCents(1_000_000) }

function deal(type: InstrumentType, seed: Round): Scenario {
  return {
    version: 3,
    currency: 'EUR',
    rounds: [
      {
        id: 'entry',
        label: 'Pre-seed',
        date: '2025-01-01',
        valuationCents: CAP,
        valuationBasis: 'post',
        raisedCents: CHEQUE,
        participation: {
          type,
          amountCents: CHEQUE,
          entryFee: NO_FEE,
          ...(type === 'equity' ? {} : { discount: DISCOUNT }),
          ...(type === 'cla' ? { interestRate: INTEREST } : {}),
        },
      },
      seed,
    ],
    fees: { carry: { percent: 0, basis: 'per_deal' } },
    exit: { date: '2032-01-01', valueCents: 0, totalRaisedCents: 0 },
  }
}

interface Converted {
  convertingCents: number
  /** Ownership by each route, whether or not it won. */
  routes: Record<ConversionRoute, number>
  winner: ConversionRoute
  ownership: number
}

function converted(type: 'safe' | 'cla', seed: Round): Converted {
  const run = runScenario(deal(type, seed))
  const conversion = run.rounds[1]?.conversion
  if (!conversion) throw new Error(`The ${type} example did not convert.`)
  const routes = Object.fromEntries(
    conversionRoutes(conversion.convertingCents, conversion.capPostCents, DISCOUNT, roundTerms(seed)).map((r) => [r.route, r.ownership]),
  ) as Record<ConversionRoute, number>
  return { convertingCents: conversion.convertingCents, routes, winner: conversion.route, ownership: run.finalOwnership }
}

const shares = runScenario(deal('equity', SEED))
const cheapShares = runScenario(deal('equity', CHEAP_SEED))
const seedTerms = roundTerms(SEED)
const cheapTerms = roundTerms(CHEAP_SEED)

export const INSTRUMENT_FACTS = {
  currency: 'EUR' as const,
  chequeCents: CHEQUE,
  capCents: CAP,
  discount: DISCOUNT,
  interestRate: INTEREST,
  years: 2,
  seed: {
    label: SEED.label,
    preMoneyCents: seedTerms.preMoney,
    raisedCents: seedTerms.raised,
    postMoneyCents: seedTerms.preMoney + seedTerms.raised,
    /** Share of an existing stake that survives the round. */
    kept: seedTerms.preMoney / (seedTerms.preMoney + seedTerms.raised),
  },
  cheapSeed: {
    preMoneyCents: cheapTerms.preMoney,
    raisedCents: cheapTerms.raised,
    postMoneyCents: cheapTerms.preMoney + cheapTerms.raised,
    kept: cheapTerms.preMoney / (cheapTerms.preMoney + cheapTerms.raised),
  },
  shares: {
    initialOwnership: shares.rounds[0]?.ownershipAfter ?? 0,
    ownership: shares.finalOwnership,
    cheapOwnership: cheapShares.finalOwnership,
  },
  safe: converted('safe', SEED),
  note: converted('cla', SEED),
  cheapSafe: converted('safe', CHEAP_SEED),
  cheapNote: converted('cla', CHEAP_SEED),
}
