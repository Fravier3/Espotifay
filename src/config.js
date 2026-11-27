// Configuración central de Espotifay. Se puede cambiar al compilar con variables VITE_*.
const env = import.meta.env || {}

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
export const API_BASE = (env.VITE_API_BASE || 'https://espotifay-catalog-vercel-fran.vercel.app').replace(/\/+$/, '')
export const AUDIUS_BASE = 'https://api.audius.co/v1'
export const DEFAULT_AUDIO_SOURCES = ['https://yt.chocolatemoo53.com']
export const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://syyealdlapxmpeccaary.supabase.co'
// Clave publishable (pública por diseño): los datos los protege RLS en Supabase.
export const SUPABASE_KEY = env.VITE_SUPABASE_KEY || 'sb_publishable_t_BJFV9l8tQvcPhZlTnLlg_5fYZJCwB'
export const DEFAULT_QUERY = 'música latina éxitos'
