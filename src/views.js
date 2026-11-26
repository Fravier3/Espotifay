import { button, icon } from './icons.js'
import { key, publicArtwork, providers } from './catalog.js'

export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char])

export function cover(track, className = '') {
  const src = publicArtwork(track?.image)
  return `<div class="cover ${className}">${icon('music')}${src ? `<img src="${escape(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}</div>`
}

export function time(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0')
}
const navItems = [
  ['home', 'Inicio'], ['search', 'Buscar'], ['library', 'Tu biblioteca'], ['queue', 'Cola']
]
function nav() {
  return navItems.map(([id, label]) =>
    `<button class="nav-link" data-action="nav" data-view="${id}">${icon(id)}<span>${label}</span></button>`
  ).join('')
}

export function shell(base) {
  return `
    <aside class="rail">
      <button class="brand" data-action="nav" data-view="home"><img src="${base}icons/espotifay.svg" alt="">Espotifay</button>
      <nav aria-label="Principal">${nav()}</nav>
      <div class="rail-lists"><div class="rail-label"><span>Playlists</span>${button('add', 'Crear playlist', 'create')}</div><div id="side-lists"></div></div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <button class="brand mobile-brand" data-action="nav" data-view="home"><img src="${base}icons/espotifay.svg" alt="">Espotifay</button>
        <button class="quick-search" data-action="nav" data-view="search">${icon('search')}<span>Busca una canción o artista</span></button>
        <div class="top-actions"><button class="source-pill" data-action="settings" id="source"></button>${button('settings', 'Ajustes', 'settings')}</div>
      </header>
      <section id="youtube-region" hidden aria-label="Reproductor de YouTube">
        <div id="youtube-frame"></div>
        <p>YouTube puede pausar la música al bloquear la pantalla.</p>
      </section>
      <main id="view" tabindex="-1"></main>
    </div>
    <footer class="player-shell"><div id="player"></div><nav class="mobile-nav" aria-label="Principal móvil">${nav()}</nav></footer>
    <dialog id="dialog" aria-label="Opciones"></dialog>
    <div id="toast" role="status"></div>`
}

export function empty(message) {
  return `<div class="empty">${icon('music')}<p>${escape(message)}</p></div>`
}

export function row(track, position, playingKey, liked = false, action = 'play', trailing = 'menu') {
  const selected = playingKey === key(track)
  return `<div class="track-row ${selected ? 'selected' : ''}">
    <span class="index">${String(position + 1).padStart(2, '0')}</span>
    <button class="track-main" data-action="${action}" data-index="${position}">
      ${cover(track)}<span class="track-text"><strong>${escape(track.title)}</strong><span>${escape(track.artist)}</span></span>
    </button>
    <span class="track-duration">${track.duration ? time(track.duration) : '—'}</span>
    ${liked ? '<span class="heart-marker" aria-label="En favoritos">' + icon('heart') + '</span>' : ''}
    ${button(trailing === 'remove-queue' ? 'close' : 'more', trailing === 'remove-queue' ? 'Quitar de la cola' : 'Opciones de la canción', trailing, `data-index="${position}"`)}
  </div>`
}
export function cards(list) {
  return list.map((track, index) => `<button class="card" data-action="play" data-index="${index}">
    <div class="card-image">${cover(track)}<span class="card-play">${icon('play')}</span></div>
    <strong>${escape(track.title)}</strong><small>${escape(track.artist)}</small>
  </button>`).join('')
}

export function controls(play) {
  const { playing, loading, shuffle, repeat, track } = play
  return `<div class="transport">
    ${button('shuffle', 'Aleatorio', 'shuffle', `aria-pressed="${shuffle}"`)}
    ${button('prev', 'Anterior', 'prev', track ? '' : 'disabled')}
    ${button(playing ? 'pause' : 'play', loading ? 'Cargando' : playing ? 'Pausar' : 'Reproducir', 'toggle', track && !loading ? '' : 'disabled', 'play-button')}
    ${button('next', 'Siguiente', 'next', track ? '' : 'disabled')}
    ${button('repeat', 'Repetir cola', 'repeat', `aria-pressed="${repeat}"`)}
  </div>`
}
export function timeline(disabled) {
  return `<div class="timeline"><span data-time>0:00</span><input type="range" aria-label="Progreso de la canción" data-range="seek" min="0" max="0" step="0.1" value="0" ${disabled ? 'disabled' : ''}><span data-total>0:00</span></div>`
}

export function sourceSettings(source) {
  return `<form id="settings-form" class="dialog-form">
    <label for="catalog">Catálogo activo</label>
    <select id="catalog" name="catalog">
      <option value="youtube" ${source === 'youtube' ? 'selected' : ''}>YouTube Music</option>
      <option value="audius" ${source === 'audius' ? 'selected' : ''}>Audius · música independiente</option>
    </select>
    <p>Las canciones de YouTube Music se reproducen con el reproductor de YouTube. La reproducción con el iPhone bloqueado sigue pendiente.</p>
    <p class="form-error" role="alert"></p>
    <button class="primary" type="submit">Guardar ajustes</button>
    <small>Espotifay 1.1.0</small>
  </form>`
}

export { providers }
