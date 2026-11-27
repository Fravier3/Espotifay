// Cuenta opcional y sincronización de la biblioteca con Supabase (tabla espotifay_libraries).
import { SUPABASE_KEY, SUPABASE_URL } from './config.js'
import { SCHEMA_VERSION, cleanLibrary, isEmptyLibrary, mergeLibraries } from './state.js'

const TABLE = 'espotifay_libraries'
const META_KEY = 'espotifay-sync'
const PUSH_DELAY = 1500
const AUTH_KEY = 'espotifay-auth'

function readMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {} } catch { return {} }
}
function writeMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)) } catch { /* Sin almacenamiento: se reintenta al volver. */ }
}

const messages = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Failed to fetch': 'Sin conexión. Intenta de nuevo cuando tengas internet.'
}
const friendly = error => messages[error?.message] || error?.message || 'No se pudo completar. Intenta de nuevo.'

/**
 * @param {{ getLibrary: () => object, applyLibrary: (library: object) => void, onChange: (state: object) => void }} hooks
 */
export function createSync({ getLibrary, applyLibrary, onChange }) {
  // supabase-js se descarga solo cuando hace falta (sesión guardada, ajustes o inicio de sesión).
  let clientPromise
  function getClient() {
    clientPromise ||= import('@supabase/supabase-js').then(({ createClient }) => {
      const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_KEY }
      })
      client.auth.onAuthStateChange((event, session) => {
        const previous = user?.id
        user = session?.user || null
        if (!user) return setStatus('signed-out')
        if (user.id !== previous) setTimeout(syncNow, 0)
        else onChange(state())
      })
      return client
    }).catch(error => { clientPromise = null; throw error })
    return clientPromise
  }
  let user = null
  let status = 'signed-out'
  let timer
  let running = null
  let meta = readMeta()

  const state = () => ({ user, email: user?.email || '', status, lastSynced: meta.lastSynced || 0, pending: Boolean(meta.pending) })
  const setStatus = next => { status = next; onChange(state()) }
  const saveMeta = changes => { meta = { ...meta, ...changes }; writeMeta(meta) }

  async function push() {
    const client = await getClient()
    const { error } = await client.from(TABLE).upsert({
      user_id: user.id, library: cleanLibrary(getLibrary()), schema_version: SCHEMA_VERSION
    })
    if (error) throw error
    saveMeta({ pending: false, user: user.id, lastSynced: Date.now() })
  }

  /** Baja la copia de la nube y la combina con la del teléfono. */
  async function syncNow() {
    if (!user) return
    if (running) return running
    running = (async () => {
      clearTimeout(timer)
      if (!navigator.onLine) return setStatus('offline')
      setStatus('syncing')
      try {
        const client = await getClient()
        const { data, error } = await client.from(TABLE).select('library').eq('user_id', user.id).maybeSingle()
        if (error) throw error
        const local = cleanLibrary(getLibrary())
        const firstTime = meta.user !== user.id
        if (!data) {
          await push()
        } else {
          const remote = cleanLibrary(data.library)
          // Cambios sin subir o primer uso con esta cuenta: se combinan ambas copias.
          if (firstTime || meta.pending) {
            const merged = firstTime && isEmptyLibrary(local) ? remote : mergeLibraries(local, remote)
            applyLibrary(merged)
            await push()
          } else {
            applyLibrary(remote)
            saveMeta({ lastSynced: Date.now() })
          }
        }
        setStatus('synced')
      } catch (error) {
        console.warn('Sincronización', error)
        setStatus(navigator.onLine ? 'error' : 'offline')
      } finally { running = null }
    })()
    return running
  }

  /** Marca cambios locales para subirlos en unos segundos. */
  function markDirty() {
    saveMeta({ pending: true })
    if (!user) return
    clearTimeout(timer)
    timer = setTimeout(syncNow, PUSH_DELAY)
  }

  async function signIn(email, password) {
    const client = await getClient()
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw Error(friendly(error))
  }

  async function signUp(email, password) {
    if (password.length < 6) throw Error('La contraseña necesita al menos 6 caracteres.')
    const client = await getClient()
    const { data, error } = await client.rpc('espotifay_sign_up', { p_email: email, p_password: password })
    if (error) throw Error(friendly(error))
    if (data === 'exists') throw Error('Ya existe una cuenta con ese correo. Inicia sesión.')
    if (data === 'limited') throw Error('Se crearon demasiadas cuentas desde esta conexión. Intenta en una hora.')
    if (data !== 'created') throw Error('Revisa el correo y usa una contraseña de 6 caracteres o más.')
    await signIn(email, password)
  }

  async function signOut() {
    if (meta.pending && user && navigator.onLine) await syncNow()
    const client = await getClient()
    await client.auth.signOut({ scope: 'local' })
    saveMeta({ user: null, lastSynced: 0 })
  }

  const refresh = () => { if (user && !document.hidden) syncNow() }
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('online', refresh)
  window.addEventListener('pagehide', () => { if (user && meta.pending) syncNow() })

  /** Carga la cuenta al abrir la app solo si ya había una sesión guardada. */
  function start() {
    let saved = false
    try { saved = Boolean(localStorage.getItem(AUTH_KEY)) } catch { /* Sin almacenamiento. */ }
    if (saved) getClient().catch(() => setStatus('offline'))
  }

  return { state, start, load: () => getClient().catch(() => {}), signIn, signUp, signOut, syncNow, markDirty }
}
