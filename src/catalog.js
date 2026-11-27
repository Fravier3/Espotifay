// Catálogos (YouTube Music vía el backend de Vercel y Audius) y resolución de audio.
import { API_BASE, AUDIUS_BASE, DEFAULT_AUDIO_SOURCES, DEFAULT_QUERY } from './config.js'
import { key } from './state.js'

export { key }
export const providers = { audius: 'Audius', youtube: 'Espotifay' }

const MEDIA_PROXY = API_BASE + '/api/media?id='
const DIRECT_TIMEOUT = 6000
const DIRECT_TTL = 120_000

async function json(url, signal) {
  const response = await fetch(url, { signal: signal || AbortSignal.timeout(10000) })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw Error(body.error || 'El catálogo no respondió. Intenta de nuevo.')
  }
  return response.json()
}

function fromAudius(track) {
  return {
    id: String(track.id), source: 'audius', title: track.title,
    artist: track.user?.name || 'Artista independiente',
    image: track.artwork?.['480x480'] || track.artwork?.['150x150'] || '',
    duration: track.duration || 0
  }
}

export async function tracks(source, query = '', signal) {
  if (source === 'youtube') {
    const data = await json(API_BASE + '/api/search?q=' + encodeURIComponent(query || DEFAULT_QUERY), signal)
    if (!Array.isArray(data.tracks)) throw Error('El catálogo devolvió una respuesta inválida.')
    return data.tracks
  }
  const path = query ? `search?query=${encodeURIComponent(query)}&limit=24` : 'trending?limit=24'
  const data = await json(`${AUDIUS_BASE}/tracks/${path}`, signal)
  return (data.data || []).filter(track => track.id && track.is_streamable !== false &&
    !track.has_stream_conditions).map(fromAudius)
}

// Fuentes de audio: la lista la da el backend (sanas primero); si no responde, se usa la de respaldo.
let sourcesPromise
export function audioSources() {
  sourcesPromise ||= json(API_BASE + '/api/sources', AbortSignal.timeout(4000))
    .then(data => Array.isArray(data.instances) && data.instances.length ? data.instances : DEFAULT_AUDIO_SOURCES)
    .catch(() => { sourcesPromise = null; return DEFAULT_AUDIO_SOURCES })
  return sourcesPromise
}

const streams = new Map()
const connectedOrigins = new Set()

function preconnectAudio(url) {
  if (typeof document === 'undefined') return
  const origin = new URL(url).origin
  if (connectedOrigins.has(origin) || connectedOrigins.size >= 4) return
  connectedOrigins.add(origin)
  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = origin
  document.head.append(link)
}

export function forgetStream(track) {
  streams.delete(key(track))
}

/** URL del audio: texto si ya se conoce, o promesa si hay que resolverla. */
export function stream(track) {
  if (track.source === 'audius') return `${AUDIUS_BASE}/tracks/${encodeURIComponent(track.id)}/stream`
  const id = key(track)
  const cached = streams.get(id)
  if (cached && cached.expires > Date.now()) return cached.value
  const pending = resolveYouTubeAudio(track).then(url => {
    if (url.startsWith(MEDIA_PROXY)) streams.delete(id)
    else {
      streams.set(id, { value: url, expires: Date.now() + DIRECT_TTL })
      preconnectAudio(url)
    }
    return url
  }).catch(error => {
    streams.delete(id)
    throw error
  })
  if (streams.size > 32) streams.delete(streams.keys().next().value)
  streams.set(id, { value: pending, expires: Date.now() + 180_000 })
  return pending
}

function directUrl(data, base) {
  const format = (data.adaptiveFormats || [])
    .filter(item => (item.type || '').startsWith('audio/mp4') && item.url)
    .sort((a, b) => Number(b.bitrate) - Number(a.bitrate))[0]
  if (!format) return ''
  const url = new URL(format.url, base)
  const trusted = url.hostname === new URL(base).hostname || url.hostname.endsWith('.googlevideo.com')
  return url.protocol === 'https:' && trusted ? url.href : ''
}

/** Intenta el enlace directo en la primera fuente sana; si falla, usa el respaldo del backend. */
async function resolveYouTubeAudio(track) {
  const [base] = await audioSources()
  try {
    const data = await json(`${base}/api/v1/videos/${encodeURIComponent(track.id)}?local=true`, AbortSignal.timeout(DIRECT_TIMEOUT))
    const url = directUrl(data, base)
    if (url) return url
  } catch { /* Una canción fallida no debe desactivar el enlace directo para las demás. */ }
  return MEDIA_PROXY + encodeURIComponent(track.id)
}
