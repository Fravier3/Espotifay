export const providers = {
  audius: 'Audius',
  youtube: 'YouTube Music'
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

export async function stream(track, endpoint) {
  if (track.source === 'audius') return `${audiusBase}/tracks/${encodeURIComponent(track.id)}/stream`
  if (!endpoint) throw Error('Configura el servidor de YouTube Music desde Ajustes.')
  const id = encodeURIComponent(track.id)
  const info = await json(`${endpoint}/api/v1/videos/${id}?local=true`)
  const formats = (info.adaptiveFormats || [])
    .filter(format => (format.type || format.mimeType || '').startsWith('audio/mp4'))
    .sort((a, b) => Number(b.bitrate) - Number(a.bitrate))
  if (!formats.length) throw Error('Esta pista no ofrece un formato de audio compatible con el iPhone.')
  const url = new URL(formats[0].url, endpoint)
  if (url.protocol !== 'https:') throw Error('El servidor devolvió un enlace de audio inválido.')
  return url.href
}
