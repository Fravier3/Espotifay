import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlayer } from '../src/player.js'

// Model Safari's per-element permission across a delayed metadata request.
test('authorizes audio during the tap and preserves the element when dismissing', async () => {
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  let inGesture = false
  let authorized = false
  let failure = ''
  const audio = Object.assign(new EventTarget(), {
    src: '', paused: true, loop: false, currentTime: 0, duration: 60,
    play() {
      if (inGesture) authorized = true
      if (!authorized) return Promise.reject(new DOMException('Tap required', 'NotAllowedError'))
      this.paused = false
      return Promise.resolve()
    },
    pause() { this.paused = true },
    load() { throw Error('Dismissing must preserve the media element') }
  })
  globalThis.window = {}
  globalThis.fetch = async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
    return new Response(JSON.stringify({ adaptiveFormats: [{ type: 'audio/mp4', url: 'https://test.googlevideo.com/permission', bitrate: 128000 }] }))
  }
  const player = createPlayer(audio, { change() {}, progress() {}, failure(error) { failure = error }, onTrack() {} })
  try {
    const track = { id: 'gesture-regression', source: 'youtube', title: 'Test' }
    inGesture = true
    player.start(track, [track])
    inGesture = false
    assert.equal(authorized, true, 'play must be called before the first await')
    assert.equal(player.state().loading, true)
    await new Promise(resolve => setTimeout(resolve, 100))
    assert.equal(failure, '')
    assert.equal(player.state().playing, true)
    assert.equal(audio.loop, false)
    const source = audio.src
    player.stop()
    assert.equal(audio.src, source)
    assert.equal(audio.paused, true)
    assert.equal(player.state().track, undefined)
    inGesture = true
    player.start(track, [track])
    inGesture = false
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(player.state().playing, true)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
  }
})

function testAudio(playbackAllowed = () => true) {
  return Object.assign(new EventTarget(), {
    src: '', paused: true, readyState: 0, currentTime: 0, duration: 60,
    plays: [],
    getAttribute() { return this.src },
    removeAttribute() { this.src = '' },
    load() { this.readyState = 0; this.pause() },
    pause() { this.paused = true },
    async play() {
      this.plays.push(this.src)
      if (!playbackAllowed()) throw new DOMException('Tap required', 'NotAllowedError')
      this.paused = false
    }
  })
}

test('starts the buffered next track and updates the buffer when the queue changes', async () => {
  const audio = testAudio()
  const standby = testAudio()
  const queue = ['one', 'two', 'three'].map(id => ({ id, source: 'audius' }))
  const player = createPlayer(audio, { standby, change() {}, progress() {}, failure: assert.fail, onTrack() {} })
  await new Promise(resolve => { player.start(queue[0], queue); setImmediate(resolve) })
  assert.equal(standby.preload, 'auto')
  assert.match(standby.src, /two\/stream$/)
  assert.deepEqual(standby.plays, [])
  player.remove(1)
  await new Promise(setImmediate)
  assert.match(standby.src, /three\/stream$/)
  standby.readyState = 3
  audio.dispatchEvent(new Event('ended'))
  await new Promise(setImmediate)
  assert.equal(player.state().track, queue[2])
  assert.equal(player.state().playing, true)
  assert.deepEqual(standby.plays, [standby.src])
  assert.equal(audio.src, '')
  assert.equal(audio.paused, true)
})

test('continues on the authorized element if automatic playback of the buffered track is blocked', async () => {
  const audio = testAudio()
  const standby = testAudio(() => false)
  const queue = ['first', 'second'].map(id => ({ id, source: 'audius' }))
  const player = createPlayer(audio, { standby, change() {}, progress() {}, failure: assert.fail, onTrack() {} })
  player.start(queue[0], queue)
  await new Promise(setImmediate)
  standby.readyState = 3
  audio.dispatchEvent(new Event('ended'))
  await new Promise(setImmediate)
  assert.match(standby.plays[0], /second\/stream$/)
  assert.equal(standby.src, '')
  assert.match(audio.plays[1], /second\/stream$/)
  assert.equal(player.state().playing, true)
})
