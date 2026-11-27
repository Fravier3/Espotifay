import { createHash } from 'node:crypto'

// Orígenes que pueden usar el backend. Se amplía con ALLOWED_ORIGINS (separados por coma).
export const allowedOrigins = [
  'https://fravier3.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)
]

/** Devuelve el origen de la petición a partir de Origin o, para <audio>, de Referer. */
export function requestOrigin(req) {
  const header = req.headers.origin || req.headers.referer || ''
  try { return new URL(header).origin } catch { return '' }
}

export function isAllowedOrigin(req) {
  return allowedOrigins.includes(requestOrigin(req))
}

/** Escribe las cabeceras CORS para el origen permitido de la petición. */
export function cors(req, res, { methods = 'GET, OPTIONS', headers = '', expose = '' } = {}) {
  const origin = requestOrigin(req)
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes(origin) ? origin : allowedOrigins[0])
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', methods)
  if (headers) res.setHeader('Access-Control-Allow-Headers', headers)
  if (expose) res.setHeader('Access-Control-Expose-Headers', expose)
}

/** Hash de la IP del cliente: nunca se guarda la IP en claro. */
export function clientFingerprint(req) {
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'desconocida').split(',')[0].trim()
  return createHash('sha256').update(ip).digest('hex')
}
