/**
 * Plain-language definitions for every financial term the calculator uses. The
 * info buttons beside the inputs read from here, so a term
 * is explained the same way everywhere it appears.
 */

export interface Term {
  /** How the info button names itself to a screen reader: "What is …?" */
  question: string
  body: string
}

export const GLOSSARY = {
  preMoney: {
    question: 'What is a pre-money valuation?',
    body: 'The company’s value immediately before the new investment goes in.',
  },
  postMoney: {
    question: 'What is a post-money valuation?',
    body: 'The company’s value once the new investment has been added: pre-money plus the amount raised. Your ownership is your cheque divided by this.',
  },
  currency: {
    question: 'Which currency is used?',
    body: 'Used for every amount, including later rounds and the exit. Switching relabels the amounts; it does not convert them.',
  },
  valuationBasis: {
    question: 'Pre-money or post-money?',
    body: 'Term sheets quote one or the other. Pre-money is the value before the raise; post-money includes it. Pick the one your deal states — mixing them up changes your ownership.',
  },
  dilution: {
    question: 'What is dilution?',
    body: 'The fall in your percentage ownership when the company issues new shares to other investors. Your shares stay the same; there are simply more shares in total.',
  },
  proRata: {
    question: 'What is pro-rata?',
    body: 'Investing enough in a later round to keep your existing percentage ownership. The amount is your current ownership multiplied by the round, plus your share of any new option pool.',
  },
  optionPool: {
    question: 'What is a new option pool?',
    body: 'Shares set aside for future employees, created as part of the round. It is usually carved out before the new money comes in, so existing holders — you included — bear the dilution.',
  },
  paperValue: {
    question: 'What is paper value?',
    body: 'Your ownership multiplied by the company’s latest valuation. It is an implied figure, not a price anyone has offered: it does not mean your stake could be sold for that amount today.',
  },
  moic: {
    question: 'What is the multiple?',
    body: 'What comes back divided by what you put in, also called MOIC (multiple on invested capital). A 5× multiple means the investment returned five times its cost.',
  },
  irr: {
    question: 'What is IRR?',
    body: 'Internal rate of return: the yearly growth rate that turns your cheques into the exit proceeds on their dates. The longer the wait, the lower the IRR for the same multiple.',
  },
  preferences: {
    question: 'Why can a low exit pay less than my percentage?',
    body: 'Later investors usually hold a liquidation preference: they get their money back before anyone shares the rest. When a company sells for less than, or not much more than, the capital it raised, that preference can take most of the proceeds.',
  },
  entryFee: {
    question: 'What is an entry fee?',
    body: 'A one-off fee some syndicates and SPVs charge on each cheque. It is paid on top of your investment, so the whole investment still buys shares.',
  },
  carry: {
    question: 'What is carry?',
    body: 'The share of your profit a syndicate lead or fund keeps, commonly 20%. It is taken from proceeds above what you invested, and only when there is a profit.',
  },
  managementFee: {
    question: 'What is a management fee?',
    body: 'A yearly fee some funds and SPVs charge on the capital invested. It is paid on top of your investment.',
  },
} satisfies Record<string, Term>

export type TermKey = keyof typeof GLOSSARY
