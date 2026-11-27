import { Innertube } from 'youtubei.js'
import { cors } from '../lib/http.js'

const DEFAULT_QUERY = 'música latina éxitos'
const VIDEO_ID = /^[\w-]{11}$/
let client

/** Convierte un resultado de YouTube Music al formato de canción de la PWA. */
export function toTrack(song) {
  const thumbnails = [...(song.thumbnail?.contents || song.thumbnails || [])]
  return {
    id: song.id,
    source: 'youtube',
    title: String(song.title || ''),
    artist: song.artists?.map(artist => artist.name).join(', ') || String(song.author?.name || ''),
    image: thumbnails.sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || '',
    duration: song.duration?.seconds || 0
  }
}

export function songsFrom(result) {
  const items = (result.contents || []).flatMap(shelf => shelf.contents || [])
  const seen = new Set()
  return items.filter(song => VIDEO_ID.test(song.id || '') && song.title && !seen.has(song.id) && seen.add(song.id))
    .map(toTrack)
}

/** Busca canciones en YouTube Music. */
export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' })
  const query = String(req.query.q || DEFAULT_QUERY).trim().slice(0, 160)
  if (!query) return res.status(400).json({ error: 'Escribe una canción o artista' })
  try {
    client ||= Innertube.create({ retrieve_player: false, lang: 'es', location: 'US' })
    const tube = await client
    const result = await tube.music.search(query, { type: 'song' })
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    res.json({ tracks: songsFrom(result) })
  } catch (error) {
    client = undefined
    console.error('Catálogo', error.message)
    res.status(502).json({ error: 'Espotifay no respondió. Intenta nuevamente.' })
  }
}
