import { artworkSources } from './artwork.js'
import { key, stream, forgetStream } from './catalog.js'

export function nextIndex(index, total, direction, { repeat, shuffle }, random = Math.random) {
  if (!total) return -1
  if (shuffle && total > 1) return (index + 1 + Math.floor(random() * (total - 1))) % total
  const next = index + direction
  if (next >= 0 && next < total) return next
  return repeat ? (next + total) % total : -1
}

export function createPlayer(audio, { standby = null, change, progress, failure, onTrack }) {
  let queue = []
  let index = -1
  let serial = 0
  let loading = false
  let loadedKey = ''
  let hasStarted = false
  let recoveryUsed = false
  let shuffle = false
  let repeat = false
  let priming = false
  let upcoming = null
  const elements = standby ? [audio, standby] : [audio]
  const track = () => queue[index]
  const state = () => ({ queue, index, track: track(), playing: hasStarted && !audio.paused && !loading, loading, shuffle, repeat })

  function resolve(item) {
    return stream(item)
  }

  function clearMedia(element) {
    if (!element?.getAttribute('src')) return
    element.removeAttribute('src')
    element.load()
  }

  function clearUpcoming() {
    upcoming = null
    clearMedia(standby)
  }

  function prepareNext() {
    if (!hasStarted || loading) return
    const position = nextIndex(index, queue.length, 1, { repeat, shuffle })
    if (position < 0 || position === index || navigator.connection?.saveData) {
      clearUpcoming()
      return
    }
    const item = queue[position]
    if (upcoming?.key === key(item)) {
      upcoming.position = position
      return
    }
    clearUpcoming()
    const prepared = { position, key: key(item), url: '' }
    upcoming = prepared
    Promise.resolve(resolve(item)).then(url => {
      if (upcoming !== prepared) return
      prepared.url = url
      if (standby) {
        standby.preload = 'auto'
        standby.src = url
      }
    }).catch(() => {})
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

  // Authorize this same media element during the tap, before metadata awaits.
  // Safari grants media permission per element; retain it when dismissing the bar.
  function prime() {
    if (loadedKey || priming) return
    priming = true
    audio.src = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='
    audio.loop = true
    audio.play().catch(() => {})
  }

  async function playAudio(request, element = audio) {
    let timer
    try {
      await Promise.race([
        element.play(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            if (serial === request) element.pause()
            reject(new DOMException('El audio no respondió a tiempo.', 'TimeoutError'))
          }, 15000)
        })
      ])
    } finally { clearTimeout(timer) }
  }

  async function select(position, retry = false, resumeAt = 0, fromGesture = false) {
    if (!queue[position]) return
    const request = ++serial
    index = position
    loading = true
    hasStarted = false
    recoveryUsed = retry
    audio.pause()
    const item = track()
    const preparedUrl = !retry && upcoming?.key === key(item) ? upcoming.url : ''
    const preloaded = preparedUrl && standby?.readyState >= 3 && !standby.error
    upcoming = null
    if (!preloaded) clearMedia(standby)
    change()
    try {
      const source = preparedUrl || resolve(item)
      if (fromGesture && typeof source !== 'string') prime()
      const url = typeof source === 'string' ? source : await source
      if (serial !== request) return
      priming = false
      audio.loop = false
      loadedKey = key(item)
      syncMedia(item)
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback' } catch { /* Optional platform hint. */ }
      if (preloaded) {
        const prepared = standby
        try {
          await playAudio(request, prepared)
          if (serial !== request) return
          standby = audio
          audio = prepared
          clearMedia(standby)
        } catch {
          if (serial !== request) return
          clearMedia(standby)
          audio.src = url
          await playAudio(request)
        }
      } else {
        audio.src = url
        await playAudio(request)
      }
      if (serial !== request) return
      hasStarted = true
      if (resumeAt > 0 && Number.isFinite(audio.duration)) audio.currentTime = Math.min(resumeAt, audio.duration)
      syncPlaybackState()
      updateProgress()
      onTrack(item)
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
        prepareNext()
        change()
      }
    }
  }
  function stop() {
    serial++
    index = -1
    loading = false
    hasStarted = false
    loadedKey = ''
    recoveryUsed = false
    clearUpcoming()
    audio.pause()
    priming = false
    audio.loop = false
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = null
        navigator.mediaSession.playbackState = 'none'
      } catch { /* Preserve dismissal on browsers with partial media-session support. */ }
    }
    progress(0, 0)
    change()
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
    const next = direction === 1 && upcoming ? upcoming.position :
      nextIndex(index, queue.length, direction, { repeat, shuffle })
    if (next >= 0) select(next, false, 0, !automatic)
    else change()
  }
  async function toggle() {
    if (!track() || loading) return
    if (audio.paused) {
      if (loadedKey !== key(track()) || audio.error) {
        forgetStream(track())
        return select(index, false, 0, true)
      }
      try {
        if (audio.ended) audio.currentTime = 0
        await audio.play()
      } catch (error) { failure(error.message) }
    } else audio.pause()
  }
  function onError() {
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
  }
  for (const element of elements) {
    element.addEventListener('error', () => { if (element === audio) onError() })
    element.addEventListener('ended', () => {
      if (element === audio && !loading && track() && loadedKey === key(track())) advance(1, true)
    })
    for (const type of ['playing', 'pause']) element.addEventListener(type, () => {
      if (element !== audio || priming) return
      if (type === 'playing') hasStarted = true
      syncPlaybackState()
      change()
    })
    for (const type of ['timeupdate', 'loadedmetadata', 'durationchange']) element.addEventListener(type, () => {
      if (element === audio) updateProgress()
    })
  }
  function updateProgress() {
    progress(Number.isFinite(audio.duration) ? audio.duration : 0, audio.currentTime)
  }
  function syncPlaybackState() {
    try {
      if (navigator.mediaSession) navigator.mediaSession.playbackState = hasStarted && !audio.paused ? 'playing' : 'paused'
    } catch { /* Some browsers expose only part of the media session API. */ }
  }
  const actions = {
    play: () => { if (audio.paused) toggle() },
    pause: () => audio.pause(), previoustrack: () => advance(-1),
    nexttrack: () => advance(1), seekto: e => { if (Number.isFinite(e.seekTime)) audio.currentTime = e.seekTime }
  }
  for (const [name, handler] of Object.entries(actions)) {
    try { navigator.mediaSession?.setActionHandler(name, handler) } catch { /* Browser action unsupported. */ }
  }
  return {
    state, select: position => select(position, false, 0, true), toggle, advance, stop,
    prepare(item) { return Promise.resolve(resolve(item)).catch(() => {}) },
    duration: () => loading ? 0 : audio.duration,
    currentTime: () => loading ? 0 : audio.currentTime,
    seek(seconds) {
      if (Number.isFinite(seconds) && seconds >= 0 && Number.isFinite(audio.duration)) audio.currentTime = seconds
    },
    volume(value) { for (const element of elements) element.volume = value },
    start(item, list) {
      queue = list.slice()
      let position = queue.findIndex(entry => key(entry) === key(item))
      if (position < 0) { position = queue.length; queue.push(item) }
      select(position, false, 0, true)
    },
    add(item) { queue = [...queue, item]; prepareNext(); change() },
    remove(position) {
      if (position === index) return
      queue = queue.filter((_, i) => i !== position)
      if (position < index) index--
      prepareNext()
      change()
    },
    shuffle() { shuffle = !shuffle; prepareNext(); change() },
    repeat() { repeat = !repeat; prepareNext(); change() }
  }
}
