import { Readable } from 'node:stream'
import { clientFingerprint, cors, isAllowedOrigin } from '../lib/http.js'
import { findAudio, forget, markFailure } from '../lib/invidious.js'
import { allowMedia } from '../lib/limits.js'

const VIDEO_ID = /^[\w-]{11}$/
const PASSTHROUGH = ['content-type', 'content-range', 'content-length', 'accept-ranges']

/** Retransmite el audio de una canción para la PWA (respaldo cuando el enlace directo falla). */
export default async function handler(req, res) {
  cors(req, res, { headers: 'Range', expose: 'Content-Length, Content-Range, Accept-Ranges' })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).end()
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Origen no permitido' })

  const id = String(req.query.id || '')
  if (!VIDEO_ID.test(id)) return res.status(400).json({ error: 'Identificador inválido' })

  const [allowed, audio] = await Promise.all([
    allowMedia(clientFingerprint(req)),
    findAudio(id).catch(error => ({ error }))
  ])
  if (!allowed) {
    res.setHeader('Retry-After', '600')
    return res.status(429).json({ error: 'Demasiadas canciones en poco tiempo. Intenta en unos minutos.' })
  }
  if (audio.error) {
    console.error('Audio', id, audio.error.message)
    return res.status(502).json({ error: 'La fuente de audio no está disponible. Intenta más tarde.' })
  }

  try {
    const upstream = await fetch(audio.url, {
      headers: { Range: req.headers.range || 'bytes=0-' },
      signal: AbortSignal.timeout(60_000)
    })
    if (!upstream.ok || !upstream.headers.get('content-type')?.startsWith('audio/')) {
      forget(id)
      markFailure(audio.base)
      throw Error('El audio respondió ' + upstream.status)
    }
    res.status(upstream.status)
    for (const name of PASSTHROUGH) {
      const value = upstream.headers.get(name)
      if (value) res.setHeader(name, value)
    }
    res.setHeader('Cache-Control', 'no-store')
    const stream = Readable.fromWeb(upstream.body)
    req.on('close', () => stream.destroy())
    stream.on('error', () => res.destroy())
    stream.pipe(res)
  } catch (error) {
    console.error('Audio', id, error.message)
    if (!res.headersSent) res.status(502).json({ error: 'La fuente de audio no está disponible. Intenta más tarde.' })
  }
}
