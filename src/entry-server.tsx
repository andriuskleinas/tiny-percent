import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'
import { LegalPage } from './landing/LegalPage'
import { FAQ } from './landing/faq'
import { SITE } from './site'

/**
 * Build-time rendering. `tools/prerender.mjs` calls these after `vite build` and
 * writes the results into the static HTML, so the page's content, head tags and
 * crawl files exist before any JavaScript runs. Nothing here is used in the
 * browser bundle.
 */

export type Page = 'home' | 'privacy' | 'terms'

const PATHS: Record<Page, string> = { home: '/', privacy: '/privacy', terms: '/terms' }

const TITLES: Record<Page, string> = {
  home: SITE.title,
  privacy: `Privacy — ${SITE.name}`,
  terms: `Terms of use — ${SITE.name}`,
}

const DESCRIPTIONS: Record<Page, string> = {
  home: SITE.description,
  privacy: 'What the Angel Investment Calculator does and does not collect: no accounts, no cookies, no analytics.',
  terms: 'Terms of use for the Angel Investment Calculator, a free educational tool that does not give investment advice.',
}

export function renderPage(page: Page): string {
  return renderToString(<StrictMode>{page === 'home' ? <App /> : <LegalPage page={page} />}</StrictMode>)
}

function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** JSON inside a script tag: `<` is escaped so no string in it can close the tag. */
function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

export function headTags(page: Page): string {
  const url = `${SITE.url}${PATHS[page]}`
  const title = TITLES[page]
  const description = DESCRIPTIONS[page]
  const tags = [
    `<link rel="canonical" href="${attr(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${attr(SITE.name)}" />`,
    `<meta property="og:title" content="${attr(title)}" />`,
    `<meta property="og:description" content="${attr(description)}" />`,
    `<meta property="og:url" content="${attr(url)}" />`,
    `<meta property="og:image" content="${attr(`${SITE.url}/og.png`)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${attr(`${SITE.name}: see what your angel investment could become.`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${attr(title)}" />`,
    `<meta name="twitter:description" content="${attr(description)}" />`,
    `<meta name="twitter:image" content="${attr(`${SITE.url}/og.png`)}" />`,
    `<meta name="theme-color" content="#2e4a7d" />`,
  ]
  if (page !== 'home') {
    tags.push(`<meta name="description" content="${attr(description)}" />`)
    return tags.join('\n    ')
  }
  tags.push(
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE.name,
      url: `${SITE.url}/`,
      description: SITE.description,
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    }),
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    }),
  )
  return tags.join('\n    ')
}

export function sitemap(): string {
  const urls = (Object.values(PATHS) as string[])
    .map((path) => `  <url><loc>${SITE.url}${path}</loc></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function robots(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`
}
