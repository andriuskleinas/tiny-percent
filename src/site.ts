/**
 * Facts about who runs the site, shown on the Privacy and Terms pages.
 * `contactEmail` must be filled in before the legal pages go live: a privacy
 * notice has to say who is responsible for the data and how to reach them.
 */
export const SITE = {
  name: 'TinyPercent',
  /**
   * Production origin, no trailing slash.
   * TODO(domain): switch to https://tinypercent.com once the domain points at Vercel.
   */
  url: 'https://startup-investment-calculator.vercel.app',
  title: 'TinyPercent — Angel Investment Calculator for Dilution & Follow-ons',
  description:
    'Free angel investment calculator. See whether your startup stake compounds or shrinks as the company raises, what follow-on and pro-rata cheques do, and what your equity could return at exit.',
  /** Legal name of the person or company operating the site. */
  operator: undefined as string | undefined,
  contactEmail: undefined as string | undefined,
  legalUpdated: '16 September 2026',
  /**
   * The waiting-list form. Hidden while the site is purely educational; the form,
   * `/api/waitlist` and the Google Sheet stay in place, so switching this back on
   * shows the form and the matching privacy wording again.
   */
  waitlist: false as boolean,
}
