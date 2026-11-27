// Genera dist/sw.js y dist/version.json después de `vite build`.
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'

const { version } = JSON.parse(await readFile('package.json', 'utf8'))
await writeFile('dist/version.json', JSON.stringify({ version }) + '\n')

const files = (await readdir('dist', { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name !== 'sw.js' && entry.name !== 'version.json')
  .map(entry => entry.parentPath.replace(/^dist/, '.') + '/' + entry.name)
  .sort()
const hash = createHash('sha256').update(version)
for (const path of files) hash.update(await readFile('dist/' + path))

await writeFile('dist/sw.js', `// Espotifay ${version}
const prefix = 'espotifay-'
const version = prefix + '${hash.digest('hex').slice(0, 14)}'
const artwork = prefix + 'artwork'
const catalog = prefix + 'catalog'
const shell = ${JSON.stringify(files)}
const artworkHosts = /(^|\\.)(googleusercontent\\.com|ggpht\\.com|ytimg\\.com|audius\\.co)$/
const catalogApi = 'https://espotifay-catalog-vercel-fran.vercel.app/api/search'
const MAX_ARTWORK = 80
const MAX_SEARCHES = 30

self.addEventListener('install', event => {
  event.waitUntil(caches.open(version).then(cache => cache.addAll(shell)))
})
self.addEventListener('message', event => {
  if (event.data === 'activate' || event.data === 'SKIP_WAITING') self.skipWaiting()
})
self.addEventListener('activate', event => {
  const keep = [version, artwork, catalog]
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(prefix) && !keep.includes(key)).map(key => caches.delete(key))
  )).then(() => self.clients.claim()))
})

async function trim(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map(key => cache.delete(key)))
}

// Portadas: primero la caché; si no está, red y se guarda (con límite).
async function artworkFirst(request) {
  const cache = await caches.open(artwork)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone())
    trim(artwork, MAX_ARTWORK)
  }
  return response
}

// Búsquedas: primero la red; sin conexión se muestra el último resultado guardado.
async function catalogNetworkFirst(request) {
  const cache = await caches.open(catalog)
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
      trim(catalog, MAX_SEARCHES)
    }
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw error
  }
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('range') || request.destination === 'audio') return
  const url = new URL(request.url)
  if (request.destination === 'image' && artworkHosts.test(url.hostname)) {
    event.respondWith(artworkFirst(request))
    return
  }
  if (url.href.startsWith(catalogApi)) {
    event.respondWith(catalogNetworkFirst(request))
    return
  }
  if (!url.href.startsWith(self.registration.scope)) return
  if (url.pathname.endsWith('/version.json')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() =>
      caches.open(version).then(cache => cache.match('./index.html'))))
  } else if (shell.some(path => new URL(path, self.registration.scope).href === url.href)) {
    event.respondWith(caches.open(version).then(cache => cache.match(request))
      .then(response => response || fetch(request)))
  }
})
`)
