import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LegalBody } from './LegalPage'
import { LEGAL_VERSIONS, legalDate } from './legalVersions'
import type { LegalPageName } from './legalVersions'

/**
 * "Last updated" must be the day a page's wording actually changed. Each page's
 * text is fingerprinted; if it no longer matches `legalVersions.ts`, the text
 * changed without its date, and this fails until both are updated.
 */

function fingerprint(page: LegalPageName): string {
  const text = renderToStaticMarkup(<LegalBody page={page} />)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

const PAGES: LegalPageName[] = ['privacy', 'terms']

describe('the legal pages are dated by their wording', () => {
  it.each(PAGES)('%s: the recorded date belongs to the wording on the page', (page) => {
    const now = fingerprint(page)
    expect(
      now,
      `The ${page} page's wording has changed. In src/landing/legalVersions.ts, set ${page}.updated to today's date ` +
        `(YYYY-MM-DD) and ${page}.fingerprint to '${now}'.`,
    ).toBe(LEGAL_VERSIONS[page].fingerprint)
  })

  it.each(PAGES)('%s: the date is a real day, and not in the future', (page) => {
    const { updated } = LEGAL_VERSIONS[page]
    expect(updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isNaN(Date.parse(updated))).toBe(false)
    expect(Date.parse(updated)).toBeLessThanOrEqual(Date.now())
  })

  it('writes dates the way the pages always have', () => {
    expect(legalDate('2026-10-23')).toBe('23 October 2026')
    expect(legalDate('2026-10-04')).toBe('4 October 2026')
  })
})
