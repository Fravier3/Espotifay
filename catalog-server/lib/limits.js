// Límite de uso por oyente, guardado en Supabase (espotifay_private.media_limits).
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://syyealdlapxmpeccaary.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_t_BJFV9l8tQvcPhZlTnLlg_5fYZJCwB'

/**
 * Devuelve false solo si Supabase confirma que se superó el límite.
 * Si Supabase no responde, se permite la petición para no cortar la música.
 */
export async function allowMedia(fingerprint, fetcher = fetch) {
  try {
    const response = await fetcher(SUPABASE_URL + '/rest/v1/rpc/espotifay_media_allow', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_client: fingerprint }),
      signal: AbortSignal.timeout(2500)
    })
    if (!response.ok) return true
    return (await response.json()) !== false
  } catch (error) {
    console.warn('Límite de audio no disponible', error.message)
    return true
  }
}
