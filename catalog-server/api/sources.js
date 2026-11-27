import { cors } from '../lib/http.js'
import { instances, ordered } from '../lib/invidious.js'

/** Lista de fuentes de audio, sanas primero, para que la PWA intente el enlace directo. */
export default function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).end()
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  res.json({ instances: ordered(instances()) })
}
