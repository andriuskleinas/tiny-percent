/**
 * Facts about who runs the site, shown on the Privacy and Terms pages.
 * `contactEmail` must be filled in before the legal pages go live: a privacy
 * notice has to say who is responsible for the data and how to reach them.
 */
export const SITE = {
  name: 'TinyPercent',
  /**
   * Production origin, no trailing slash.
   */
  url: 'https://tinypercent.com',
  title: 'TinyPercent — Angel Investment Calculator for Dilution & Follow-ons',
  description:
    'Free angel investment calculator. See whether your startup stake compounds or shrinks as the company raises, what follow-on and pro-rata cheques do, and what your equity could return at exit.',
  /** Legal name of the person or company operating the site. */
  operator: undefined as string | undefined,
  contactEmail: undefined as string | undefined,
  legalUpdated: '4 October 2026',
  /**
   * The waiting-list form. Hidden while the site is purely educational. The form,
   * its handler in src/server/waitlist.ts and the Google Sheet stay in place, but
   * the production site is static Cloudflare assets with no `/api/waitlist`
   * endpoint: switching this back on needs that endpoint deployed first.
   */
  waitlist: false as boolean,
}
