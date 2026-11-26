import { button, icon } from './icons.js'
import { cover, escape } from './views.js'

export function libraryView(prefs, filter, order, layout) {
  const collections = [
    { id: 'favorites', name: 'Favoritas', tracks: prefs.favorites, mark: 'heart' },
    { id: 'recent', name: 'Escuchadas recientemente', tracks: prefs.recent, mark: 'clock' },
    ...prefs.playlists.slice().reverse().map(item => ({ ...item, mark: 'music' }))
  ]
  const count = size => size === 1 ? '1 canción' : size + ' canciones'
  const filtered = filter === 'artists' ? prefs.artists.map(artist => ({ ...artist, artist: true })) :
    filter === 'playlists' ? collections.filter(item => item.id !== 'recent') : collections
  const items = order === 'name' ? filtered.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')) : filtered
  return `<div class="content library-content">
    <div class="page-heading with-action"><h1>Tu biblioteca</h1><div class="inline">${button('search', 'Buscar música', 'library-search')}${button('add', 'Crear playlist', 'create')}</div></div>
    <div class="filter-tabs" aria-label="Filtrar biblioteca">${[['all', 'Todo'], ['playlists', 'Playlists'], ['artists', 'Artistas']].map(([value, label]) =>
      `<button data-action="library-filter" data-filter="${value}" aria-pressed="${filter === value}">${label}</button>`).join('')}</div>
    <div class="library-toolbar"><button class="text-button" data-action="library-sort">${icon('sort')}${order === 'name' ? 'Por nombre' : 'Recientes'}</button>
    ${button(layout === 'grid' ? 'library' : 'grid', layout === 'grid' ? 'Ver lista' : 'Ver cuadrícula', 'library-layout')}</div>
    <div class="library-items ${layout === 'grid' ? 'as-grid' : ''}">${items.map(item =>
      `<button class="library-item" data-action="${item.artist ? 'artist-search' : 'open-list'}" ${item.artist ? `data-name="${escape(item.name)}"` : `data-id="${escape(item.id)}"`}>
        ${item.artist ? cover(item, 'artist-cover') : item.tracks?.[0] ? cover(item.tracks[0]) : `<span class="collection-icon mark-${item.mark}">${icon(item.mark)}</span>`}
        <span class="library-item-text"><strong>${escape(item.name)}</strong><small>${item.artist ? 'Artista guardado' : count(item.tracks.length)}</small></span>
      </button>`).join('') || '<p class="library-empty">Guarda un artista desde el menú de una canción.</p>'}</div>
  </div>`
}
