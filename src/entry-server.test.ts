import { describe, expect, it } from 'vitest'
import { headTags, renderPage, sitemap, robots } from './entry-server'
import { SITE } from './site'

/**
 * The build writes these into the static HTML, so search engines and link
 * previews see the whole page without running JavaScript. This file runs in
 * plain Node, with no DOM, which is exactly where the prerender runs: any
 * component touching `window` during render fails here first.
 */

describe('the prerendered home page', () => {
  const html = renderPage('home')

  it('contains the headline and the calculator as HTML', () => {
    expect(html).toContain('See what your startup investment could become')
    expect(html).toContain('Run your own numbers')
    expect(html).toContain('Investment amount')
    expect(html).not.toContain('Frequently asked questions')
  })

  it('shows the default calculation, with its figures', () => {
    expect(html).toContain('0.10%')
    expect(html).toContain('€51,200')
  })
})

describe('the prerendered legal pages', () => {
  it('renders privacy and terms', () => {
    expect(renderPage('privacy')).toContain('<h1')
    expect(renderPage('privacy')).toContain('no cookies')
    expect(renderPage('terms')).toContain('Terms of use')
  })
})

describe('head tags', () => {
  const home = headTags('home')

  it('declares the canonical address and a share preview', () => {
    expect(home).toContain(`<link rel="canonical" href="${SITE.url}/"`)
    expect(home).toContain('<meta property="og:title"')
    expect(home).toContain(`<meta property="og:image" content="${SITE.url}/og.png"`)
    expect(home).toContain('<meta name="twitter:card" content="summary_large_image"')
  })

  it('describes the app as structured data, and no longer claims an FAQ', () => {
    const blocks = [...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1] as string))
    expect(blocks.find((b) => b['@type'] === 'FAQPage')).toBeUndefined()
    const app = blocks.find((b) => b['@type'] === 'WebApplication')
    expect(app.offers.price).toBe('0')
    expect(app.isAccessibleForFree).toBe(true)
  })

  it('cannot be broken out of by text containing a closing script tag', () => {
    expect(home.match(/<\/script>/g)?.length).toBe(home.match(/<script/g)?.length)
  })

  it('gives each legal page its own canonical address', () => {
    expect(headTags('privacy')).toContain(`<link rel="canonical" href="${SITE.url}/privacy"`)
    expect(headTags('terms')).toContain(`<link rel="canonical" href="${SITE.url}/terms"`)
  })
})

describe('crawl files', () => {
  it('lists the three pages in the sitemap and points robots at it', () => {
    const xml = sitemap()
    for (const path of ['/', '/privacy', '/terms']) expect(xml).toContain(`<loc>${SITE.url}${path}</loc>`)
    expect(robots()).toContain(`Sitemap: ${SITE.url}/sitemap.xml`)
    expect(robots()).toContain('Allow: /')
  })
})
