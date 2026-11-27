// Fuentes de audio Invidious con conmutación automática.
// Se configuran con INVIDIOUS_INSTANCES (URLs HTTPS separadas por coma), en orden de preferencia.
export const DEFAULT_INSTANCES = ['https://yt.chocolatemoo53.com']
const COOLDOWN_MS = 5 * 60 * 1000
const LOOKUP_TIMEOUT_MS = 8000
const cache = new Map()
const failures = new Map()

export function instances(env = process.env.INVIDIOUS_INSTANCES) {
  const list = String(env || '').split(',').map(value => value.trim().replace(/\/+$/, ''))
    .filter(value => /^https:\/\/[\w.-]+$/.test(value))
  return list.length ? [...new Set(list)] : DEFAULT_INSTANCES
}

/** Instancias sanas primero; las que fallaron hace poco quedan al final. */
export function ordered(list, now = Date.now()) {
  const healthy = list.filter(base => !(failures.get(base) > now))
  const cooling = list.filter(base => failures.get(base) > now)
  return [...healthy, ...cooling]
}

export function markFailure(base, now = Date.now()) { failures.set(base, now + COOLDOWN_MS) }
export function markSuccess(base) { failures.delete(base) }
export function resetHealth() { failures.clear(); cache.clear() }

/** Elige el formato AAC de mayor calidad y valida que el enlace sea de un dominio esperado. */
export function bestAudio(data, base) {
  const format = (data?.adaptiveFormats || [])
    .filter(item => String(item.type || '').startsWith('audio/mp4') && item.url)
    .sort((a, b) => Number(b.bitrate) - Number(a.bitrate))[0]
  if (!format) return ''
  const url = new URL(format.url, base)
  const trusted = url.hostname === new URL(base).hostname || url.hostname.endsWith('.googlevideo.com')
  return url.protocol === 'https:' && trusted ? url.href : ''
}

/** Busca el audio de un video recorriendo las instancias hasta que una responda. */
export async function findAudio(id, { list = instances(), fetcher = fetch } = {}) {
  const cached = cache.get(id)
  if (cached && cached.expires > Date.now()) return cached.value
  const errors = []
  for (const base of ordered(list)) {
    try {
      const response = await fetcher(`${base}/api/v1/videos/${encodeURIComponent(id)}?local=true`,
        { signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) })
      if (!response.ok) throw Error('respondió ' + response.status)
      const url = bestAudio(await response.json(), base)
      if (!url) throw Error('sin audio AAC')
      markSuccess(base)
      const value = { url, base }
      cache.set(id, { value, expires: Date.now() + 60_000 })
      if (cache.size > 200) cache.delete(cache.keys().next().value)
      return value
    } catch (error) {
      markFailure(base)
      errors.push(`${new URL(base).hostname}: ${error.message}`)
    }
  }
  throw Error('Ninguna fuente respondió (' + errors.join('; ') + ')')
}

export function forget(id) { cache.delete(id) }
