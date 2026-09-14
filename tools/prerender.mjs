// Writes the server-rendered pages, head tags and crawl files into `dist/`.
// Runs after `vite build` and `vite build --ssr`; see the `build` script.
import { readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const server = await import(pathToFileURL(`${root}dist-ssr/entry-server.js`).href)

const pages = [
  ['home', 'dist/index.html', '<div id="root"></div>'],
  ['privacy', 'dist/privacy.html', '<div id="root" data-page="privacy"></div>'],
  ['terms', 'dist/terms.html', '<div id="root" data-page="terms"></div>'],
]

for (const [page, file, placeholder] of pages) {
  const path = `${root}${file}`
  const html = await readFile(path, 'utf8')
  if (!html.includes(placeholder)) throw new Error(`${file}: root placeholder not found`)
  const body = server.renderPage(page)
  const out = html
    .replace('</head>', `    ${server.headTags(page)}\n  </head>`)
    .replace(placeholder, placeholder.replace('></div>', `>${body}</div>`))
  await writeFile(path, out)
  console.log(`prerendered ${file} (${Math.round(out.length / 1024)} kB)`)
}

await writeFile(`${root}dist/sitemap.xml`, server.sitemap())
await writeFile(`${root}dist/robots.txt`, server.robots())
await rm(`${root}dist-ssr`, { recursive: true, force: true })
console.log('wrote dist/sitemap.xml and dist/robots.txt')
