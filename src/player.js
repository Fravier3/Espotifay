import { key, publicArtwork, stream } from './catalog.js'

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
  let shuffle = false
  let repeat = false
  let prepared = new Map()
  const track = () => queue[index]
  const state = () => ({ queue, index, track: track(), playing: !audio.paused && !loading, loading, shuffle, repeat })

  function resolve(item) {
    const id = key(item)
    if (!prepared.has(id)) {
      const entry = stream(item, endpoint()).then(url => {
        prepared.set(id, url)
        return url
      }).catch(error => {
        prepared.delete(id)
        throw error
      })
      prepared.set(id, entry)
    }
    return prepared.get(id)
  }

  function syncMedia(item) {
    if (!('mediaSession' in navigator) || !('MediaMetadata' in window)) return
    const src = publicArtwork(item.image)
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.title,
      artist: item.artist,
      artwork: src ? [{ src }] : []
    })
  }

  async function select(position) {
    if (!queue[position]) return
    const request = ++serial
    index = position
    loading = true
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
      onTrack(item)
      if (queue[index + 1]) resolve(queue[index + 1]).catch(() => {})
    } catch (error) {
      if (serial === request) failure(item.source === 'youtube' ? 'La fuente de audio de Yutu no pudo entregar esta canción. Intenta más tarde.' : error.message || 'No se pudo reproducir esta canción.')
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
        prepared.delete(key(track()))
        return select(index)
      }
      try {
        if (audio.ended) audio.currentTime = 0
        await audio.play()
      } catch (error) { failure(error.message) }
    } else audio.pause()
  }
  audio.addEventListener('error', () => {
    if (!loading && track() && loadedKey === key(track())) failure('No se pudo cargar el audio. Intenta reproducirlo de nuevo.')
  })
  audio.addEventListener('ended', () => advance(1, true))
  for (const type of ['play', 'pause']) audio.addEventListener(type, () => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing'
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
    duration: () => audio.duration,
    currentTime: () => audio.currentTime,
    seek(seconds) {
      if (Number.isFinite(seconds) && seconds >= 0 && Number.isFinite(audio.duration)) audio.currentTime = seconds
    },
    volume(value) { audio.volume = value },
    start(item, list) {
      prepared = new Map()
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
