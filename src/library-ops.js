// Operaciones sobre la biblioteca. Cada una modifica prefs y devuelve un mensaje para el usuario.
import { key } from './state.js'

export const isFavorite = (prefs, item) => prefs.favorites.some(track => key(track) === key(item))

export function toggleFavorite(prefs, item) {
  const had = isFavorite(prefs, item)
  prefs.favorites = had ? prefs.favorites.filter(track => key(track) !== key(item)) : [item, ...prefs.favorites]
  return had ? 'Quitada de favoritas' : 'Guardada en favoritas'
}

export function addRecent(prefs, item) {
  prefs.recent = [item, ...prefs.recent.filter(track => key(track) !== key(item))].slice(0, 24)
}

export function saveArtist(prefs, item) {
  const exists = prefs.artists.some(artist => artist.name.toLowerCase() === item.artist.toLowerCase())
  if (!exists) prefs.artists.unshift({ name: item.artist, image: item.image, source: item.source, id: item.id })
  return { changed: !exists, message: exists ? 'Este artista ya está guardado' : 'Artista guardado en tu biblioteca' }
}

export function createPlaylist(prefs, name, firstTrack, id = crypto.randomUUID()) {
  const playlist = { id, name, tracks: firstTrack ? [firstTrack] : [], updatedAt: Date.now() }
  prefs.playlists.push(playlist)
  return playlist
}

export function renamePlaylist(prefs, id, name) {
  const playlist = prefs.playlists.find(item => item.id === id)
  if (!playlist) return false
  playlist.name = name
  playlist.updatedAt = Date.now()
  return true
}

export function deletePlaylist(prefs, id) {
  prefs.playlists = prefs.playlists.filter(item => item.id !== id)
  prefs.removed = [...prefs.removed.filter(item => item !== id), id].slice(-200)
}

export function addToPlaylist(prefs, id, item) {
  const playlist = prefs.playlists.find(entry => entry.id === id)
  if (!playlist) return { changed: false, message: 'La playlist ya no existe' }
  if (playlist.tracks.some(track => key(track) === key(item))) return { changed: false, message: 'La canción ya está en esta playlist' }
  playlist.tracks.push(item)
  playlist.updatedAt = Date.now()
  return { changed: true, message: 'Añadida a ' + playlist.name }
}

export function removeFromPlaylist(prefs, id, item) {
  const playlist = prefs.playlists.find(entry => entry.id === id)
  if (!playlist) return false
  playlist.tracks = playlist.tracks.filter(track => key(track) !== key(item))
  playlist.updatedAt = Date.now()
  return true
}

/** Coloca la biblioteca recibida (de la nube o de una copia) dentro de prefs. */
export function applyLibrary(prefs, library) {
  Object.assign(prefs, {
    favorites: library.favorites, recent: library.recent, artists: library.artists,
    playlists: library.playlists, removed: library.removed
  })
}
