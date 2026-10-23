/**
 * When each legal page's wording last changed. The "Last updated" date on the
 * page comes from here, so it is the day the text actually changed, never the
 * day of an unrelated deploy.
 *
 * `legal.updated.test.tsx` fingerprints each page's wording. Change a word of
 * either page without updating its entry here and the tests fail, which stops
 * the deploy. After editing a page: set `updated` to today's date (YYYY-MM-DD)
 * and `fingerprint` to the value the failing test prints.
 */
export const LEGAL_VERSIONS = {
  privacy: { updated: '2026-10-23', fingerprint: '7e80b70c146d13a7' },
  terms: { updated: '2026-10-04', fingerprint: '9dad1cafe69ba488' },
} as const

export type LegalPageName = keyof typeof LEGAL_VERSIONS

/** "23 October 2026", the way the pages have always written it. Read in UTC, so it never shifts a day. */
export function legalDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(iso))
}
