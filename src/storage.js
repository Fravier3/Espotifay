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
