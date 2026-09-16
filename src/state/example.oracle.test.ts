import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { strategyPaths } from '../engine/paths'
import { outcomesAt, runScenario } from '../engine/scenario'
import { EXAMPLE, EXIT_PRESETS_CENTS, HERO_EXAMPLE } from './presets'

/**
 * The €5,000 example is what the page shows before anyone types, and every
 * figure it prints about it comes from the engine. This holds the preset and the
 * exit table to golden case L in `tools/oracle.py`, which checks the same deal
 * against an independent share ledger.
 */

interface Fixture {
  L: {
    path: number[]
    finalOwnership: number
    proRataSeriesACents: number
    totalRaisedCents: number
    ladder: Array<{ valueCents: number; regime: string; lowCents: number; highCents: number }>
  }
  M: {
    exitCents: number
    carryPercent: number
    sitOut: { path: number[]; valuesCents: number[]; investedCents: number; grossCents: number }
    proRata: { path: number[]; chequesCents: number[]; investedCents: number; grossCents: number; netCents: number }
  }
}

const { L, M } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../tools/golden-cases.json', import.meta.url)), 'utf8'),
) as Fixture

const PLACES = 12

describe('the €5,000 example agrees with the Python oracle', () => {
  it('walks 0.10% down to 0.0512% across Series A, B and C', () => {
    const run = runScenario(EXAMPLE)
    expect(run.rounds).toHaveLength(L.path.length)
    run.rounds.forEach((round, i) => expect(round.ownershipAfter).toBeCloseTo(L.path[i] as number, PLACES))
    expect(run.finalOwnership).toBeCloseTo(L.finalOwnership, PLACES)
    expect(EXAMPLE.exit.totalRaisedCents).toBe(L.totalRaisedCents)
  })

  it('quotes what holding 0.10% through Series A would cost', () => {
    expect(runScenario(EXAMPLE).rounds[1]?.proRataCents).toBe(L.proRataSeriesACents)
  })

  it('gets every row of the exit table right, regime and bounds', () => {
    expect(EXIT_PRESETS_CENTS).toEqual(L.ladder.map((row) => row.valueCents))
    outcomesAt(EXAMPLE, EXIT_PRESETS_CENTS).forEach((row, i) => {
      const want = L.ladder[i]
      expect(row.exit.regime).toBe(want?.regime)
      expect(row.exit.lowCents).toBe(want?.lowCents)
      expect(row.exit.highCents).toBe(want?.highCents)
    })
  })
})

describe('the three paths through the €5,000 example agree with the oracle (case M)', () => {
  const paths = strategyPaths({ ...EXAMPLE, fees: { carry: { percent: M.carryPercent, basis: 'per_deal' } } })

  it('sitting out walks the stake down and still ends at €128,000', () => {
    expect(EXAMPLE.exit.valueCents).toBe(M.exitCents)
    paths.sitOut.points.forEach((p, i) => {
      expect(p.ownership).toBeCloseTo(M.sitOut.path[i] as number, PLACES)
      expect(p.stakeValueCents).toBe(M.sitOut.valuesCents[i])
    })
    expect(paths.sitOut.run.totalInvestedCents).toBe(M.sitOut.investedCents)
    expect(paths.sitOut.run.exit.highCents).toBe(M.sitOut.grossCents)
  })

  it('pro-rata writes €3,000, €8,000 and €20,000 to hold 0.10%', () => {
    paths.proRata.points.forEach((p, i) => {
      expect(p.ownership).toBeCloseTo(M.proRata.path[i] as number, PLACES)
      expect(p.chequeCents).toBe(M.proRata.chequesCents[i])
    })
    expect(paths.proRata.run.totalInvestedCents).toBe(M.proRata.investedCents)
    expect(paths.proRata.run.exit.highCents).toBe(M.proRata.grossCents)
    expect(paths.proRata.run.feesHigh.netCents).toBe(M.proRata.netCents)
  })
})

describe('the hero tells the same example from a Pre-seed cheque', () => {
  it('differs from the example only in its round names', () => {
    expect(HERO_EXAMPLE.rounds.map((r) => r.label)).toEqual(['Pre-seed', 'Seed', 'Series A', 'Series B'])
    const unnamed = (s: typeof EXAMPLE) => ({ ...s, rounds: s.rounds.map(({ id: _id, label: _label, ...r }) => r) })
    expect(unnamed(HERO_EXAMPLE)).toEqual(unnamed(EXAMPLE))
    runScenario(HERO_EXAMPLE).rounds.forEach((round, i) => expect(round.ownershipAfter).toBeCloseTo(L.path[i] as number, PLACES))
  })
})
