import assert from 'node:assert/strict'
import test from 'node:test'
import { stream } from '../src/catalog.js'

test('selection and preloading share one metadata request and reuse the resolved URL', async () => {
  let calls = 0
  const original = globalThis.fetch
  const url = 'https://test.googlevideo.com/audio'
  globalThis.fetch = async () => {
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
