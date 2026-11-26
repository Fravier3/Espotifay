import { artworkSources } from './artwork.js'
import { key, stream, forgetStream } from './catalog.js'

export function nextIndex(index, total, direction, { repeat, shuffle }, random = Math.random) {
  if (!total) return -1
  if (shuffle && total > 1) return (index + 1 + Math.floor(random() * (total - 1))) % total
  const next = index + direction
  if (next >= 0 && next < total) return next
  return repeat ? (next + total) % total : -1
}

export function createPlayer(audio, { endpoint, change, progress, failure, onTrack }) {
  let queue = []
  let index = -1
  let serial = 0
  let loading = false
  let loadedKey = ''
  let hasStarted = false
  let recoveryUsed = false
  let shuffle = false
  let repeat = false
  const track = () => queue[index]
  const state = () => ({ queue, index, track: track(), playing: hasStarted && !audio.paused && !loading, loading, shuffle, repeat })

  function resolve(item) {
    return stream(item)
  }

  function syncMedia(item) {
    if (!('mediaSession' in navigator) || !('MediaMetadata' in window)) return
    const src = artworkSources(item)[0]
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.title,
      artist: item.artist,
      artwork: src ? [{ src }] : []
    })
  }

  async function select(position, retry = false, resumeAt = 0) {
    if (!queue[position]) return
    const request = ++serial
    index = position
    loading = true
    hasStarted = false
    recoveryUsed = retry
    audio.pause()
    const item = track()
    change()
    try {
      const preparedUrl = resolve(item)
      const url = typeof preparedUrl === 'string' ? preparedUrl : await preparedUrl
      if (serial !== request) return
      audio.src = url
      loadedKey = key(item)
      syncMedia(item)
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback' } catch { /* Optional platform hint. */ }
      await audio.play()
      if (serial !== request) return
      hasStarted = true
      if (resumeAt > 0 && Number.isFinite(audio.duration)) audio.currentTime = Math.min(resumeAt, audio.duration)
      onTrack(item)
      if (queue[index + 1]) Promise.resolve(resolve(queue[index + 1])).catch(() => {})
    } catch (error) {
      if (serial === request) {
        forgetStream(item)
        if (!retry && error.name !== 'NotAllowedError') return select(index, true, resumeAt)
        hasStarted = false
        audio.pause()
        failure(error.name === 'NotAllowedError' ? 'Toca reproducir para iniciar la música.' :
          'No se pudo conectar con el audio de esta canción. Toca reproducir para reintentar.')
      }
    } finally {
      if (serial === request) {
        loading = false
        change()
      }
    }
  }
  function advance(direction, automatic = false) {
    if (direction < 0 && !automatic && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    if (automatic && repeat && queue.length === 1) {
      audio.currentTime = 0
      audio.play().catch(error => failure(error.message))
      return
    }
    const next = nextIndex(index, queue.length, direction, { repeat, shuffle })
    if (next >= 0) select(next)
    else change()
  }
  async function toggle() {
    if (!track() || loading) return
    if (audio.paused) {
      if (loadedKey !== key(track()) || audio.error) {
        forgetStream(track())
        return select(index)
      }
      try {
        if (audio.ended) audio.currentTime = 0
        await audio.play()
      } catch (error) { failure(error.message) }
    } else audio.pause()
  }
  audio.addEventListener('error', () => {
    if (loading || !audio.error || !track() || loadedKey !== key(track())) return
    hasStarted = false
    forgetStream(track())
    if (!recoveryUsed) {
      select(index, true, audio.currentTime)
    } else {
      audio.pause()
      failure('No se pudo recuperar el audio. Toca reproducir para reintentar.')
      change()
    }
  })
  audio.addEventListener('ended', () => advance(1, true))
  for (const type of ['playing', 'pause']) audio.addEventListener(type, () => {
    if (type === 'playing') hasStarted = true
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = hasStarted && !audio.paused ? 'playing' : 'paused'
    change()
  })
  for (const type of ['timeupdate', 'loadedmetadata', 'durationchange']) audio.addEventListener(type, () => {
    progress(Number.isFinite(audio.duration) ? audio.duration : 0, audio.currentTime)
  })
  const actions = {
    play: () => { if (audio.paused) toggle() },
    pause: () => audio.pause(), previoustrack: () => advance(-1),
    nexttrack: () => advance(1), seekto: e => { if (Number.isFinite(e.seekTime)) audio.currentTime = e.seekTime }
  }
  for (const [name, handler] of Object.entries(actions)) {
    try { navigator.mediaSession?.setActionHandler(name, handler) } catch { /* Browser action unsupported. */ }
  }
  return {
    state, select, toggle, advance,
    prepare(item) { return Promise.resolve(resolve(item)).catch(() => {}) },
    duration: () => loading ? 0 : audio.duration,
    currentTime: () => loading ? 0 : audio.currentTime,
    seek(seconds) {
      if (Number.isFinite(seconds) && seconds >= 0 && Number.isFinite(audio.duration)) audio.currentTime = seconds
    },
    volume(value) { audio.volume = value },
    start(item, list) {
      queue = list.slice()
      let position = queue.findIndex(entry => key(entry) === key(item))
      if (position < 0) { position = queue.length; queue.push(item) }
      select(position)
    },
    add(item) { queue = [...queue, item]; change() },
    remove(position) {
      if (position === index) return
      queue = queue.filter((_, i) => i !== position)
      if (position < index) index--
      change()
    },
    shuffle() { shuffle = !shuffle; change() },
    repeat() { repeat = !repeat; change() }
  }
}
