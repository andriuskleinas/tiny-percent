import { compactMoney, money, ownership } from '../ui/format'
import { EXAMPLE_FACTS } from './example'

/**
 * The FAQ as plain strings, so the page and (in Phase 3) the search engines'
 * structured data say exactly the same thing. Example figures are computed.
 */

const eur = (cents: number) => money(cents, EXAMPLE_FACTS.currency)
const eurShort = (cents: number) => compactMoney(cents, EXAMPLE_FACTS.currency)

export const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: 'How is startup ownership calculated?',
    answer:
      `Your ownership is your investment divided by the company’s post-money valuation — its value once the round’s new money is in. ` +
      `${eur(EXAMPLE_FACTS.chequeCents)} into a round that raises ${eurShort(EXAMPLE_FACTS.raisedCents)} at a ${eurShort(EXAMPLE_FACTS.preMoneyCents)} pre-money valuation ` +
      `(${eurShort(EXAMPLE_FACTS.postMoneyCents)} post-money) buys ${ownership(EXAMPLE_FACTS.initialOwnership)} of the company.`,
  },
  {
    question: 'What is dilution?',
    answer:
      'When a company raises more money it issues new shares. You keep the same number of shares, but they are a smaller slice of a larger total, so your percentage falls. ' +
      `In the example, a Series A that raises a fifth of its post-money valuation takes a ${ownership(EXAMPLE_FACTS.initialOwnership)} stake to ${ownership(EXAMPLE_FACTS.seriesA.ownership)}. A new option pool for employees dilutes you the same way.`,
  },
  {
    question: 'What does pro-rata mean?',
    answer:
      'Pro-rata is investing enough in a later round to keep your existing percentage. The amount is your current ownership multiplied by the size of the round, plus your share of any new option pool. ' +
      `Holding ${ownership(EXAMPLE_FACTS.initialOwnership)} through a ${eurShort(EXAMPLE_FACTS.seriesA.raisedCents)} Series A costs ${eur(EXAMPLE_FACTS.seriesA.proRataCents)}.`,
  },
  {
    question: 'What is the difference between pre-money and post-money valuation?',
    answer:
      'Pre-money is what the company is worth immediately before the new investment; post-money is pre-money plus the amount raised. ' +
      'Term sheets quote one or the other, and mixing them up changes your ownership, so the calculator asks which one your deal uses.',
  },
  {
    question: 'Is the calculated stake value real money?',
    answer:
      'No. The stake value is an implied paper value: your ownership multiplied by the latest valuation. It does not mean anyone would buy your shares for that amount, or that you could sell them at all before an exit.',
  },
  {
    question: 'Does the calculator predict startup returns?',
    answer:
      'No. Exit figures are hypothetical scenarios built from the assumptions you enter, not forecasts. Most startups do not exit at the valuations shown, and at a low exit, later investors’ liquidation preferences can take priority over your share.',
  },
  {
    question: 'Is the calculator free?',
    answer: 'Yes. Every part of the calculator is free to use.',
  },
  {
    question: 'Do I need an account?',
    answer:
      'No. There is no sign-up. Your calculation stays in your browser, and sharing it creates a link that carries the numbers in its address.',
  },
]
