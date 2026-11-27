import assert from 'node:assert/strict'
import test from 'node:test'
import { stream } from '../src/catalog.js'

test('selection and preloading share one metadata request and reuse the resolved URL', async () => {
  let calls = 0
  const original = globalThis.fetch
  const url = 'https://test.googlevideo.com/audio'
  globalThis.fetch = async request => {
    if (String(request).includes('/api/sources')) return new Response(JSON.stringify({ instances: ['https://inv.test'] }))
    calls++
    return new Response(JSON.stringify({ adaptiveFormats: [{ type: 'audio/mp4', url, bitrate: '128000' }] }))
  }
  try {
    const track = { source: 'youtube', id: 'speed-test' }
    const first = stream(track)
    const second = stream(track)
    assert.strictEqual(first, second)
    assert.equal(await first, url)
    assert.equal(stream(track), url)
    assert.equal(calls, 1)
  } finally { globalThis.fetch = original }
})

test('a slow metadata response remains eligible for direct playback', async () => {
  const original = globalThis.fetch
  const url = 'https://test.googlevideo.com/slow-audio'
  globalThis.fetch = (request, { signal }) => String(request).includes('/api/sources') ? Promise.resolve(new Response('{}')) : new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(new Response(JSON.stringify({
      adaptiveFormats: [{ type: 'audio/mp4', url, bitrate: '128000' }]
    }))), 2200)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    }, { once: true })
  })
  try {
    assert.equal(await stream({ source: 'youtube', id: 'slow-metadata' }), url)
  } finally { globalThis.fetch = original }
})

test('a failed song does not disable direct playback or cache the proxy as a successful URL', async () => {
  const original = globalThis.fetch
  const track = { source: 'youtube', id: 'temporary-failure' }
  const url = 'https://test.googlevideo.com/recovered'
  let calls = 0
  globalThis.fetch = async request => {
    if (String(request).includes('/api/sources')) return new Response(JSON.stringify({ instances: ['https://inv.test'] }))
    calls++
    return calls === 1 ? new Response('', { status: 403 }) :
      new Response(JSON.stringify({ adaptiveFormats: [{ type: 'audio/mp4', url, bitrate: '128000' }] }))
  }
  try {
    assert.ok((await stream(track)).includes('/api/media?'))
    assert.equal(await stream(track), url)
    assert.equal(calls, 2)
  } finally { globalThis.fetch = original }
})
