// Guardado local en el teléfono.
const sessionKey = 'espotifay-v1'

export function load() {
  try {
    const stored = JSON.parse(localStorage.getItem(sessionKey) || '{}')
    return stored && typeof stored === 'object' ? stored : {}
  } catch { return {} }
}

export function save(data) {
  try {
    localStorage.setItem(sessionKey, JSON.stringify(data))
    return true
  } catch { return false }
}

/** Pide al navegador que no borre los datos de Espotifay por falta de uso o espacio. */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch { return false }
}
