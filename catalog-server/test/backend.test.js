import assert from 'node:assert/strict'
import test from 'node:test'
import { bestAudio, findAudio, instances, ordered, resetHealth } from '../lib/invidious.js'
import { isAllowedOrigin, clientFingerprint } from '../lib/http.js'
import { allowMedia } from '../lib/limits.js'
import { songsFrom } from '../api/search.js'

const json = data => new Response(JSON.stringify(data))
const audio = url => ({ adaptiveFormats: [
  { type: 'audio/webm', url: 'https://a.googlevideo.com/webm', bitrate: '999999' },
  { type: 'audio/mp4', url: 'https://a.googlevideo.com/low', bitrate: '64000' },
  { type: 'audio/mp4', url, bitrate: '128000' }
] })

test('instances come from the environment, are deduplicated and fall back to the default', () => {
  assert.deepEqual(instances('https://a.test/, https://b.test,https://a.test,http://inseguro.test'), ['https://a.test', 'https://b.test'])
  assert.deepEqual(instances(''), ['https://yt.chocolatemoo53.com'])
})

test('picks the best AAC format and rejects untrusted hosts', () => {
  assert.equal(bestAudio(audio('https://r1.googlevideo.com/best'), 'https://inv.test'), 'https://r1.googlevideo.com/best')
  assert.equal(bestAudio(audio('/latest_version?id=x'), 'https://inv.test'), 'https://inv.test/latest_version?id=x')
  assert.equal(bestAudio(audio('https://malicioso.test/a'), 'https://inv.test'), '')
  assert.equal(bestAudio({}, 'https://inv.test'), '')
})

test('fails over to the next instance and remembers the unhealthy one', async () => {
  resetHealth()
  const calls = []
  const fetcher = async url => {
    calls.push(new URL(url).hostname)
    return url.startsWith('https://caida.test') ? new Response('', { status: 403 }) : json(audio('https://r.googlevideo.com/ok'))
  }
  const list = ['https://caida.test', 'https://sana.test']
  assert.equal((await findAudio('aaaaaaaaaaa', { list, fetcher })).url, 'https://r.googlevideo.com/ok')
  assert.deepEqual(calls, ['caida.test', 'sana.test'])
  assert.deepEqual(ordered(list), ['https://sana.test', 'https://caida.test'])
  await findAudio('bbbbbbbbbbb', { list, fetcher })
  assert.equal(calls.at(-1), 'sana.test')
  assert.equal(calls.length, 3)
})

test('reports every failed instance when none respond', async () => {
  resetHealth()
  await assert.rejects(findAudio('ccccccccccc', { list: ['https://x.test'], fetcher: async () => new Response('', { status: 500 }) }),
    /x\.test: respondió 500/)
})

test('accepts the PWA origin from Origin or Referer and rejects others', () => {
  assert.ok(isAllowedOrigin({ headers: { origin: 'https://fravier3.github.io' } }))
  assert.ok(isAllowedOrigin({ headers: { referer: 'https://fravier3.github.io/Espotifay/' } }))
  assert.ok(!isAllowedOrigin({ headers: { referer: 'https://otro.test/' } }))
  assert.ok(!isAllowedOrigin({ headers: {} }))
})

test('fingerprints the client IP without storing it', () => {
  const value = clientFingerprint({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } })
  assert.match(value, /^[a-f0-9]{64}$/)
  assert.ok(!value.includes('203'))
})

test('media limit blocks only when Supabase says so', async () => {
  assert.equal(await allowMedia('a'.repeat(64), async () => json(false)), false)
  assert.equal(await allowMedia('a'.repeat(64), async () => json(true)), true)
  assert.equal(await allowMedia('a'.repeat(64), async () => { throw Error('sin red') }), true)
})

test('search keeps valid unique songs only', () => {
  const song = { id: 'OampN5hXqAU', title: 'Diles', artists: [{ name: 'Ozuna' }], thumbnails: [{ url: 's', width: 60 }, { url: 'l', width: 120 }], duration: { seconds: 200 } }
  const tracks = songsFrom({ contents: [{ contents: [song, song, { id: 'corto', title: 'x' }, { id: 'abcdefghijk' }] }] })
  assert.deepEqual(tracks, [{ id: 'OampN5hXqAU', source: 'youtube', title: 'Diles', artist: 'Ozuna', image: 'l', duration: 200 }])
})
