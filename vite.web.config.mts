import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/**
 * Web / iPhone (PWA) build of the renderer — `npm run build:web` → dist-web/.
 * Relative base, so it works on GitHub Pages under any repo path (hash router).
 */

const HEAD = `
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#000000" />
    <meta name="color-scheme" content="dark" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Vialintia" />
    <meta name="format-detection" content="telephone=no" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" type="image/svg+xml" href="./icons/icon.svg" />
    <link rel="apple-touch-icon" href="./icons/icon-180.png" />`

/** Injects the PWA head tags and writes a precaching service worker listing every built file. */
function pwa(): Plugin {
  return {
    name: 'vialintia-pwa',
    transformIndexHtml(html) {
      return html.replace('</title>', `</title>${HEAD}`)
    },
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'))
      const assets = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png']
      const list = [...new Set([...assets, ...files.filter((f) => f !== 'index.html')])]
      const hash = createHash('sha1').update(list.join('|')).update(String(Date.now())).digest('hex').slice(0, 10)
      const sw = `/* Vialintia service worker — generated at build */
const CACHE = 'vialintia-${pkg.version}-${hash}'
const PRECACHE = ${JSON.stringify(list)}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vialintia-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    // App shell: network first (picks up new releases), cache when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('index.html', copy))
          return res
        })
        .catch(() => caches.match('index.html', { ignoreSearch: true }))
    )
    return
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
    )
  )
})
`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw })
    }
  }
}

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  publicDir: resolve(__dirname, 'src/renderer/web-public'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [react(), pwa()],
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    target: 'safari15'
  },
  server: { host: true }
})
