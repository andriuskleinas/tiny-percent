/**
 * Facts about who runs the site, shown on the Privacy and Terms pages.
 * `contactEmail` must be filled in before the legal pages go live: a privacy
 * notice has to say who is responsible for the data and how to reach them.
 */
export const SITE = {
  name: 'Angel Investment Calculator',
  /** Production origin, no trailing slash. Change here when a custom domain is added. */
  url: 'https://startup-investment-calculator.vercel.app',
  title: 'Angel Investment Calculator — Equity, Dilution & Exit Returns',
  description:
    'Free angel investment calculator. Calculate startup equity, model dilution and follow-on rounds, estimate pro-rata requirements and explore potential exit outcomes.',
  /** Legal name of the person or company operating the site. */
  operator: undefined as string | undefined,
  contactEmail: undefined as string | undefined,
  legalUpdated: '14 September 2026',
}
