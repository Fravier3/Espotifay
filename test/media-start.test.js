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
    await new Promise(resolve => setTimeout(resolve, 50))
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
