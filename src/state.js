// Modelo de la biblioteca: validación, normalización y combinación de datos.
export const SCHEMA_VERSION = 3
const LIMITS = { favorites: 2000, recent: 24, artists: 300, playlists: 200, playlistTracks: 1000 }
const text = (value, max = 300) => typeof value === 'string' ? value.slice(0, max) : ''

export function key(track) {
  return `${track.source}:${track.id}`
}

/** Devuelve una canción válida o null si el registro está dañado. */
export function cleanTrack(value) {
  if (!value || typeof value !== 'object') return null
  const source = value.source === 'audius' ? 'audius' : value.source === 'youtube' ? 'youtube' : ''
  const id = text(String(value.id ?? ''), 64)
  const title = text(value.title)
  if (!source || !id || !title) return null
  if (source === 'youtube' && !/^[\w-]{11}$/.test(id)) return null
  const duration = Number(value.duration)
  return {
    id, source, title,
    artist: text(value.artist) || 'Artista desconocido',
    image: /^https:\/\//.test(value.image || '') ? text(value.image, 1000) : '',
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0
  }
}

export function cleanTracks(list, limit) {
  const seen = new Set()
  const result = []
  for (const item of Array.isArray(list) ? list : []) {
    const track = cleanTrack(item)
    if (!track || seen.has(key(track))) continue
    seen.add(key(track))
    result.push(track)
    if (result.length >= limit) break
  }
  return result
}

function cleanPlaylist(value) {
  if (!value || typeof value !== 'object') return null
  const id = text(String(value.id ?? ''), 64)
  const name = text(value.name, 60).trim()
  if (!id || !name) return null
  return { id, name, tracks: cleanTracks(value.tracks, LIMITS.playlistTracks), updatedAt: Number(value.updatedAt) || 0 }
}

function cleanArtist(value) {
  const name = text(value?.name, 120).trim()
  if (!name) return null
  return { name, image: /^https:\/\//.test(value.image || '') ? text(value.image, 1000) : '', source: value.source === 'audius' ? 'audius' : 'youtube', id: text(String(value.id ?? ''), 64) }
}

function unique(list, id, clean, limit) {
  const seen = new Set()
  const result = []
  for (const item of Array.isArray(list) ? list : []) {
    const value = clean(item)
    if (!value || seen.has(id(value))) continue
    seen.add(id(value))
    result.push(value)
    if (result.length >= limit) break
  }
  return result
}

/** Datos de la biblioteca (lo que se sincroniza y se exporta). */
export function cleanLibrary(data = {}) {
  return {
    favorites: cleanTracks(data.favorites, LIMITS.favorites),
    recent: cleanTracks(data.recent, LIMITS.recent),
    artists: unique(data.artists, artist => artist.name.toLowerCase(), cleanArtist, LIMITS.artists),
    playlists: unique(data.playlists, playlist => playlist.id, cleanPlaylist, LIMITS.playlists),
    removed: Array.isArray(data.removed) ? data.removed.filter(id => typeof id === 'string').slice(-200) : []
  }
}

/** Preferencias completas guardadas en el teléfono. */
export function cleanPrefs(data = {}) {
  return {
    ...cleanLibrary(data),
    schemaVersion: SCHEMA_VERSION,
    provider: data.provider === 'audius' && data.catalogVersion >= 2 ? 'audius' : 'youtube',
    catalogVersion: 2,
    libraryOrder: data.libraryOrder === 'name' ? 'name' : 'recent',
    libraryLayout: data.libraryLayout === 'grid' ? 'grid' : 'list',
    libraryUpdatedAt: Number(data.libraryUpdatedAt) || 0
  }
}

export function libraryOf(prefs) {
  const { favorites, recent, artists, playlists, removed } = prefs
  return { favorites, recent, artists, playlists, removed }
}

export function isEmptyLibrary(library) {
  return !library.favorites.length && !library.recent.length && !library.artists.length && !library.playlists.length
}

function mergeTracks(first, second, limit) {
  return cleanTracks([...first, ...second], limit)
}

/**
 * Combina dos bibliotecas sin perder nada: une favoritas, artistas e historial, y
 * combina las playlists por id. La versión "preferida" manda en nombres y orden.
 * Las playlists borradas en cualquiera de los lados quedan borradas.
 */
export function mergeLibraries(preferred, other) {
  const a = cleanLibrary(preferred)
  const b = cleanLibrary(other)
  const removed = [...new Set([...a.removed, ...b.removed])].slice(-200)
  const gone = new Set(removed)
  const playlists = new Map()
  for (const playlist of [...a.playlists, ...b.playlists]) {
    if (gone.has(playlist.id)) continue
    const existing = playlists.get(playlist.id)
    if (!existing) playlists.set(playlist.id, playlist)
    else {
      const newer = playlist.updatedAt > existing.updatedAt ? playlist : existing
      const older = newer === playlist ? existing : playlist
      playlists.set(playlist.id, { ...newer, tracks: mergeTracks(newer.tracks, older.tracks, LIMITS.playlistTracks) })
    }
  }
  return cleanLibrary({
    favorites: mergeTracks(a.favorites, b.favorites, LIMITS.favorites),
    recent: mergeTracks(a.recent, b.recent, LIMITS.recent),
    artists: [...a.artists, ...b.artists],
    playlists: [...playlists.values()],
    removed
  })
}

/** Artista que más se repite en favoritas, historial y artistas guardados. */
export function topArtists(prefs, count = 3) {
  const score = new Map()
  const add = (name, points) => {
    const artist = String(name || '').split(',')[0].trim()
    if (artist && artist !== 'Artista desconocido') score.set(artist, (score.get(artist) || 0) + points)
  }
  prefs.artists.forEach(artist => add(artist.name, 4))
  prefs.favorites.slice(0, 100).forEach(track => add(track.artist, 2))
  prefs.recent.forEach(track => add(track.artist, 1))
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([name]) => name)
}
