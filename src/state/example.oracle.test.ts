import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { outcomesAt, runScenario } from '../engine/scenario'
import { EXAMPLE, EXIT_PRESETS_CENTS } from './presets'

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
}

const { L } = JSON.parse(
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
