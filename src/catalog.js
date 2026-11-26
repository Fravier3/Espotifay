export const providers = {
  audius: 'Audius',
  youtube: 'Espotifay'
}

const audiusBase = 'https://api.audius.co/v1'

export function normalizeEndpoint(value) {
  if (!value.trim()) return ''
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Usa una dirección HTTPS sin parámetros ni credenciales.')
  }
  return url.href.replace(/\/+$/, '')
}

async function json(url, signal) {
  const response = await fetch(url, { signal: signal || AbortSignal.timeout(10000) })
  if (!response.ok) throw Error('El catálogo no respondió. Intenta de nuevo.')
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


export function key(track) {
  return `${track.source}:${track.id}`
}

export async function tracks(source, endpoint, query = '', signal) {
  if (source === 'youtube') {
    const data = await json('https://espotifay-catalog-vercel-fran.vercel.app/api/search?q=' +
      encodeURIComponent(query || 'música latina éxitos'), signal)
    if (!Array.isArray(data.tracks)) throw Error('El catálogo devolvió una respuesta inválida.')
    return data.tracks
  }
  const path = query ? `search?query=${encodeURIComponent(query)}&limit=24` : 'trending?limit=24'
  const data = await json(`${audiusBase}/tracks/${path}`, signal)
  return (data.data || []).filter(track => track.id && track.is_streamable !== false &&
    !track.has_stream_conditions).map(fromAudius)
}

export function publicArtwork(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url, location.origin)
    return parsed.protocol === 'https:' ? parsed.href : ''
  } catch { return '' }
}

const streams = new Map()

export function forgetStream(track) {
  streams.delete(key(track))
}

export function stream(track) {
  if (track.source === 'audius') return `${audiusBase}/tracks/${encodeURIComponent(track.id)}/stream`
  const id = key(track)
  const cached = streams.get(id)
  if (cached && cached.expires > Date.now()) return cached.value
  const pending = resolveYouTubeAudio(track).then(url => {
    if (url.startsWith('https://espotifay-catalog-vercel-fran.vercel.app/api/media?')) {
      streams.delete(id)
    } else {
      streams.set(id, { value: url, expires: Date.now() + 120000 })
    }
    return url
  }).catch(error => {
    streams.delete(id)
    throw error
  })
  if (streams.size > 32) streams.delete(streams.keys().next().value)
  streams.set(id, { value: pending, expires: Date.now() + 180000 })
  return pending
}

async function resolveYouTubeAudio(track) {
  try {
    const data = await json('https://yt.chocolatemoo53.com/api/v1/videos/' +
      encodeURIComponent(track.id) + '?local=true', AbortSignal.timeout(6000))
    const format = (data.adaptiveFormats || [])
      .filter(item => (item.type || '').startsWith('audio/mp4'))
      .sort((a, b) => Number(b.bitrate) - Number(a.bitrate))[0]
    if (format?.url) {
      const url = new URL(format.url, 'https://yt.chocolatemoo53.com')
      if (url.protocol === 'https:' && (url.hostname === 'yt.chocolatemoo53.com' ||
          url.hostname.endsWith('.googlevideo.com'))) return url.href
    }
  } catch { /* A failed track must not disable direct playback for other songs. */ }
  return 'https://espotifay-catalog-vercel-fran.vercel.app/api/media?id=' + encodeURIComponent(track.id)
}
