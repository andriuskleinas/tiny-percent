// Writes the server-rendered pages, head tags and crawl files into `dist/`.
// Runs after `vite build` and `vite build --ssr`; see the `build` script.
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await import(pathToFileURL(`${root}dist-ssr/entry-server.js`).href)

const pages = [
  ['home', 'dist/index.html', '<div id="root"></div>'],
  ['privacy', 'dist/privacy.html', '<div id="root" data-page="privacy"></div>'],
  ['terms', 'dist/terms.html', '<div id="root" data-page="terms"></div>'],
]

// The two faces every page uses, preloaded so they arrive before first paint
// and the text does not jump when they swap in. Other subsets load on demand.
const fonts = (await readdir(`${root}dist/assets`))
  .filter((name) => /^(inter-tight|jetbrains-mono)-latin-wght-normal-.*\.woff2$/.test(name))
  .map((name) => `<link rel="preload" href="/assets/${name}" as="font" type="font/woff2" crossorigin />`)
if (fonts.length !== 2) throw new Error(`expected 2 fonts to preload, found ${fonts.length}`)

for (const [page, file, placeholder] of pages) {
  const path = `${root}${file}`
  const html = await readFile(path, 'utf8')
  if (!html.includes(placeholder)) throw new Error(`${file}: root placeholder not found`)
  const body = server.renderPage(page)
  const out = html
    .replace('</head>', `    ${[...fonts, server.headTags(page)].join('\n    ')}\n  </head>`)
    .replace(placeholder, placeholder.replace('></div>', `>${body}</div>`))
  await writeFile(path, out)
  console.log(`prerendered ${file} (${Math.round(out.length / 1024)} kB)`)
}

await writeFile(`${root}dist/sitemap.xml`, server.sitemap())
await writeFile(`${root}dist/robots.txt`, server.robots())
await rm(`${root}dist-ssr`, { recursive: true, force: true })
console.log('wrote dist/sitemap.xml and dist/robots.txt')
