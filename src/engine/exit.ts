import { roundCents } from './money'

/**
 * Liquidation preferences depend on the full cap table, which this calculator
 * deliberately does not have. Rather than invent a precise-looking number, it
 * reports which of three regimes the exit falls in and says what that means.
 *
 * Every result carries a regime. There is no way to get a figure out of here
 * without one, because a proceeds number without that context is misleading in
 * exactly the cases where an angel most needs the truth.
 */

export type ExitRegime = 'downside' | 'uncertain' | 'clean'

export interface ExitInput {
  valueCents: number
  /** Total capital the company raised. This is what the preference stack is. */
  totalRaisedCents: number
  /** Your ownership, once your instrument has converted. */
  ownership: number
  /** Total you put in, in cents. */
  investedCents: number
  /** Set when you hold a loan that never converted. It is repaid first. */
  unconvertedLoanOwedCents?: number | undefined
  /**
   * Multiple of the capital raised above which preferences stop mattering.
   * Preferred convert once their as-converted share beats their preference, so
   * at twice the raised total that holds unless the preferred own less than
   * half the company, which is unusual by the time a company exits.
   */
  cleanMultiple?: number | undefined
}

export interface ExitProceeds {
  regime: ExitRegime
  /** Both bounds. They are equal unless the cap table decides the answer. */
  lowCents: number
  highCents: number
  uncertain: boolean
  explanation: string
}

export const DEFAULT_CLEAN_MULTIPLE = 2

function currency(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`
}

/** Your share of a 1x non-participating preference stack, capped at your money back. */
function preferenceShare(input: ExitInput): number {
  if (input.totalRaisedCents <= 0) return 0
  const share = (input.investedCents / input.totalRaisedCents) * input.valueCents
  return roundCents(Math.min(input.investedCents, share))
}

function asConverted(input: ExitInput): number {
  return roundCents(input.ownership * input.valueCents)
}

export function exitProceeds(input: ExitInput): ExitProceeds {
  const clean = input.cleanMultiple ?? DEFAULT_CLEAN_MULTIPLE
  const regime: ExitRegime =
    input.valueCents <= input.totalRaisedCents
      ? 'downside'
      : input.valueCents > input.totalRaisedCents * clean
        ? 'clean'
        : 'uncertain'

  // A loan that never converted is senior debt. It is repaid in full before any
  // equity holder sees anything, and it does not share in the upside.
  if (input.unconvertedLoanOwedCents !== undefined && input.unconvertedLoanOwedCents > 0) {
    const repaid = Math.min(input.unconvertedLoanOwedCents, input.valueCents)
    return {
      regime,
      lowCents: repaid,
      highCents: repaid,
      uncertain: false,
      explanation:
        `Your loan never converted, so it is repaid ahead of every equity holder. ` +
        `You are owed ${currency(input.unconvertedLoanOwedCents)} and the sale covers ` +
        `${currency(repaid)} of it. You do not share in the upside.`,
    }
  }

  if (regime === 'downside') {
    const proceeds = preferenceShare(input)
    return {
      regime,
      lowCents: proceeds,
      highCents: proceeds,
      uncertain: false,
      explanation:
        `The sale at ${currency(input.valueCents)} is at or below the ` +
        `${currency(input.totalRaisedCents)} the company raised, so the preference stack ` +
        `absorbs the proceeds and nobody converts. You take your share of that stack, ` +
        `not your ownership percentage.`,
    }
  }

  if (regime === 'clean') {
    const proceeds = asConverted(input)
    return {
      regime,
      lowCents: proceeds,
      highCents: proceeds,
      uncertain: false,
      explanation:
        `The sale clears the ${currency(input.totalRaisedCents)} raised by enough that ` +
        `preferred holders do better converting to common than taking their preference. ` +
        `Your ownership percentage is what you get.`,
    }
  }

  // Between the two, the answer turns on the preference stack: who is senior,
  // who participates, and who converts. None of that is visible from angel-side
  // inputs, so both bounds are reported rather than a false midpoint.
  const low = preferenceShare(input)
  const high = asConverted(input)
  return {
    regime,
    lowCents: Math.min(low, high),
    highCents: Math.max(low, high),
    uncertain: true,
    explanation:
      `The sale at ${currency(input.valueCents)} is above the ` +
      `${currency(input.totalRaisedCents)} raised but not far enough above it for the ` +
      `outcome to be obvious. Whether you land nearer ${currency(Math.min(low, high))} or ` +
      `${currency(Math.max(low, high))} depends on the preference stack — seniority, ` +
      `participation and who converts — which cannot be derived from angel-side inputs.`,
  }
}
