import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'

const files = (await readdir('dist', { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => entry.parentPath.replace(/^dist/, '.') + '/' + entry.name)
  .sort()
const hash = createHash('sha256')
for (const path of files) hash.update(await readFile('dist/' + path))
const shell = JSON.stringify(files)

await writeFile('dist/sw.js', `
const prefix = 'espotifay-'
const version = prefix + '${hash.digest('hex').slice(0, 14)}'
const shell = ${shell}
self.addEventListener('install', event => {
  event.waitUntil(caches.open(version).then(cache => cache.addAll(shell)))
})
self.addEventListener('message', event => {
  if (event.data === 'activate') self.skipWaiting()
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(prefix) && key !== version).map(key => caches.delete(key))
  )).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope) ||
      event.request.headers.has('range') || event.request.destination === 'audio') return
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() =>
      caches.open(version).then(cache => cache.match('./index.html'))))
  } else if (shell.some(path => new URL(path, self.registration.scope).href === url.href)) {
    event.respondWith(caches.open(version).then(cache => cache.match(event.request))
      .then(response => response || fetch(event.request)))
  }
})
`)
