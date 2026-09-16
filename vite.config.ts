import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { handleWaitlist } from './src/server/waitlist.ts'

/**
 * `npm run dev` has no Vercel functions, so this serves POST /api/waitlist the
 * same way `api/waitlist.ts` does, reading WAITLIST_* from .env.local.
 */
function waitlistInDev(): Plugin {
  return {
    name: 'waitlist-in-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), 'WAITLIST_')
      server.middlewares.use('/api/waitlist', (req, res) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          const body = req.method === 'POST' ? Buffer.concat(chunks).toString('utf8') : undefined
          const request = new Request('http://localhost/api/waitlist', { method: req.method ?? 'GET', body })
          void handleWaitlist(request, { scriptUrl: env['WAITLIST_SCRIPT_URL'], secret: env['WAITLIST_SECRET'] }).then(async (response) => {
            res.statusCode = response.status
            response.headers.forEach((value, key) => res.setHeader(key, value))
            res.end(await response.text())
          })
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), waitlistInDev()],
  build: {
    // Fonts are always separate files: an inlined data: font breaks the
    // `font-src 'self'` Content-Security-Policy in vercel.json and public/_headers.
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
    rollupOptions: {
      // Privacy and Terms are separate pages, so each is plain HTML at its own URL.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        privacy: fileURLToPath(new URL('./privacy.html', import.meta.url)),
        terms: fileURLToPath(new URL('./terms.html', import.meta.url)),
      },
    },
  },
  server: {
    port: Number(process.env['PORT']) || 5173,
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
