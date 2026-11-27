import './styles.css'
import { loadNextArtwork } from './artwork.js'
import { backupFile, deliverBackup, parseBackup } from './backup.js'
import { audioSources, key, tracks } from './catalog.js'
import { APP_VERSION } from './config.js'
import { explore, forYouQuery, homeFilters } from './discovery.js'
import { button, icon } from './icons.js'
import { libraryView } from './library.js'
import * as ops from './library-ops.js'
import { attachMiniDismiss } from './mini-dismiss.js'
import { createPlayer } from './player.js'
import { cleanPrefs, libraryOf, mergeLibraries } from './state.js'
import { load, requestPersistence, save } from './storage.js'
import { attachSwipeDismiss } from './swipe-dismiss.js'
import { createSync } from './sync.js'
import { accountSection, cards, controls, cover, empty, escape, providers, row, settingsView, shell, time, timeline } from './views.js'

// ── Estado ────────────────────────────────────────────────────────────────
const base = import.meta.env.BASE_URL
const $ = selector => document.querySelector(selector)
const prefs = cleanPrefs(load())
const ui = {
  view: 'home', libraryFilter: 'all', homeQuery: '', activePlaylist: '',
  list: [], discover: [], discoverStatus: 'Cargando música…',
  results: [], searchStatus: 'Busca por canción o artista.', query: '',
  selected: null, modal: ''
}
const timers = { debounce: 0, toast: 0, warm: 0 }
let request = null
let priorFocus
let warmGeneration = 0

$('#app').innerHTML = shell(base)
const dialog = $('#dialog')
const audio = $('#audio')
attachSwipeDismiss(dialog)

const player = createPlayer(audio, {
  standby: $('#upcoming-audio'),
  change: updatePlayer,
  progress: updateProgress,
  failure: notify,
  onTrack(item) {
    ops.addRecent(prefs, item)
    persist()
  }
})
attachMiniDismiss($('#player'), () => player.stop())

const sync = createSync({
  getLibrary: () => libraryOf(prefs),
  applyLibrary(library) {
    ops.applyLibrary(prefs, library)
    persist({ library: false })
    render()
    updatePlayer()
  },
  onChange() {
    if (ui.modal === 'settings' && dialog.open) $('#account-block').outerHTML = accountSection(sync.state())
  }
})

const songCount = count => count === 1 ? '1 canción' : count + ' canciones'
const isFavorite = item => ops.isFavorite(prefs, item)

// ── Guardado y avisos ─────────────────────────────────────────────────────
/** Guarda en el teléfono; si cambió la biblioteca, la sube a la nube cuando hay cuenta. */
function persist({ library = true } = {}) {
  if (!save(prefs)) notify('El navegador impidió guardar los cambios en este dispositivo.')
  if (library) sync.markDirty()
}
function notify(message) {
  clearTimeout(timers.toast)
  $('#toast').textContent = message
  $('#toast').classList.add('visible')
  timers.toast = setTimeout(() => $('#toast').classList.remove('visible'), 4200)
}

// ── Vistas ────────────────────────────────────────────────────────────────
function setView(next, playlist = '') {
  ui.view = next
  ui.activePlaylist = playlist
  render()
  $('#view').scrollTop = 0
  if (next === 'search') $('#catalog-search').focus()
  else $('#view').focus({ preventScroll: true })
}
function renderSide() {
  $('#source').innerHTML = '<span></span>' + providers[prefs.provider]
  $('#side-lists').innerHTML = prefs.playlists.map(item =>
    `<button class="side-list" data-action="open-list" data-id="${escape(item.id)}">${icon('music')}<span>${escape(item.name)}</span></button>`
  ).join('')
  document.querySelectorAll('.nav-link').forEach(item => {
    if (item.dataset.view === ui.view || (ui.view === 'playlist' && item.dataset.view === 'library')) item.setAttribute('aria-current', 'page')
    else item.removeAttribute('aria-current')
  })
}
function rows(items) {
  const current = player.state().track
  return items.map((item, index) => row(item, index, current && key(current), isFavorite(item))).join('')
}
const listStatus = (items, status) => items.length ? rows(items) : empty(status)

function homeView() {
  const list = ui.discover
  return `<div class="content home-content">
    <div class="home-heading"><h1>Escucha a tu ritmo</h1><button class="text-button" data-action="open-list" data-id="recent">${icon('clock')}Historial</button></div>
    <div class="filter-tabs" aria-label="Descubrir música">${homeFilters(prefs).map(([value, label]) =>
      `<button data-action="home-filter" data-query="${escape(value)}" aria-pressed="${ui.homeQuery === value}">${escape(label)}</button>`).join('')}</div>
    <div class="quick-collections"><button data-action="open-list" data-id="favorites"><span class="mini-mark">${icon('heart')}</span>Favoritas</button><button data-action="open-list" data-id="recent"><span class="mini-mark">${icon('clock')}</span>Últimas escuchas</button></div>
    <section class="section"><div class="section-head"><h2>Empieza por aquí</h2>${button('search', 'Buscar música', 'library-search')}</div>
      <div class="start-list">${list.length ? rows(list.slice(0, 3)) : empty(ui.discoverStatus)}</div></section>
    ${list.length ? `<section class="section"><div class="section-head"><h2>En tu frecuencia</h2></div><div class="cards album-shelf">${cards(list.slice(3, 12), 3)}</div></section>
    <section class="section"><div class="section-head"><h2>Más para descubrir</h2></div><div class="cards album-shelf">${cards(list.slice(12), 12)}</div></section>` : ''}
  </div>`
}
function searchResults() {
  return ui.query.trim() ? listStatus(ui.results, ui.searchStatus) : explore(ui.discover, prefs)
}
function searchView() {
  return `<div class="content"><div class="page-heading"><h1>Buscar</h1></div>
    <form id="search-form" class="search-form" role="search">${icon('search')}<input id="catalog-search" type="search" placeholder="¿Qué quieres escuchar?" aria-label="Canción o artista" value="${escape(ui.query)}" autocomplete="off" enterkeyhint="search"><button class="primary" type="submit">Buscar</button></form>
    <div class="search-results" id="search-results" aria-live="polite">${searchResults()}</div></div>`
}
function currentCollection() {
  if (ui.activePlaylist === 'favorites') return { name: 'Favoritas', tracks: prefs.favorites }
  if (ui.activePlaylist === 'recent') return { name: 'Historial', tracks: prefs.recent }
  return prefs.playlists.find(item => item.id === ui.activePlaylist)
}
function playlistView(collection) {
  const custom = Boolean(collection.id)
  return `<div class="content"><button class="text-button" data-action="nav" data-view="library">‹ Tu biblioteca</button>
    <div class="page-heading with-action"><div><h1>${escape(collection.name)}</h1><p>${songCount(collection.tracks.length)}</p></div>
    <div class="inline">${collection.tracks.length ? '<button class="primary" data-action="play" data-index="0">' + icon('play') + 'Reproducir</button>' : ''}
    ${custom ? button('more', 'Editar playlist', 'playlist-options') : ''}</div></div><div class="track-list">${listStatus(collection.tracks, 'Todavía no hay canciones aquí.')}</div></div>`
}
function renderQueue() {
  const play = player.state()
  const current = play.track
  ui.list = play.queue
  $('#view').innerHTML = `<div class="content"><div class="page-heading"><h1>Cola</h1><p>${songCount(ui.list.length)}</p></div>
    <div class="track-list">${ui.list.length ? ui.list.map((item, index) =>
      row(item, index, current && key(current), isFavorite(item), 'queue-play', index === play.index ? 'menu' : 'remove-queue')).join('') : empty('Reproduce una canción o agrégala a la cola.')}</div></div>`
}
function render() {
  renderSide()
  const view = $('#view')
  if (ui.view === 'home') {
    ui.list = ui.discover
    view.innerHTML = homeView()
  } else if (ui.view === 'search') {
    ui.list = ui.results
    view.innerHTML = searchView()
  } else if (ui.view === 'library') {
    ui.list = []
    view.innerHTML = libraryView(prefs, ui.libraryFilter, prefs.libraryOrder, prefs.libraryLayout)
  } else if (ui.view === 'playlist') {
    const collection = currentCollection()
    if (!collection) return setView('library')
    ui.list = collection.tracks
    view.innerHTML = playlistView(collection)
  } else renderQueue()
  schedulePreparation()
}

/** Actualiza solo los corazones de una canción sin redibujar la pantalla. */
function refreshFavorite(item) {
  const liked = isFavorite(item)
  document.querySelectorAll('.track-row').forEach(rowElement => {
    const index = Number(rowElement.querySelector('[data-action][data-index]')?.dataset.index)
    const track = ui.list[index]
    if (!track || key(track) !== key(item)) return
    const marker = rowElement.querySelector('.heart-marker')
    if (liked && !marker) rowElement.querySelector('.track-duration').insertAdjacentHTML('afterend', '<span class="heart-marker" aria-label="En favoritos">' + icon('heart') + '</span>')
    if (!liked) marker?.remove()
  })
  const current = player.state().track
  if (current && key(current) === key(item)) {
    document.querySelectorAll('[data-action="favorite-current"]').forEach(node => node.setAttribute('aria-pressed', String(liked)))
  }
}

// ── Preparación del audio de canciones visibles ───────────────────────────
function schedulePreparation() {
  clearTimeout(timers.warm)
  const generation = ++warmGeneration
  if (navigator.connection?.saveData) return
  timers.warm = setTimeout(async () => {
    const bounds = $('#view').getBoundingClientRect()
    const current = player.state().track
    const seen = new Set()
    const visible = [...$('#view').querySelectorAll('[data-action="play"]')]
      .filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.bottom > bounds.top && rect.top < bounds.bottom
      })
      .map(element => ui.list[Number(element.dataset.index)])
      .filter(item => item && (!current || key(item) !== key(current)) && !seen.has(key(item)) && seen.add(key(item)))
      .slice(0, 8)
    let cursor = 0
    async function worker() {
      while (cursor < visible.length) {
        if (generation !== warmGeneration || player.state().loading) return
        await player.prepare(visible[cursor++])
      }
    }
    await Promise.all([worker(), worker()])
  }, 150)
}
$('#view').addEventListener('scroll', schedulePreparation, { passive: true })

// ── Reproductor ───────────────────────────────────────────────────────────
function updateProgress(duration = player.duration(), elapsed = player.currentTime()) {
  const known = Number.isFinite(duration) && duration > 0
  const percent = known ? elapsed / duration * 100 : 0
  if ($('#mini-progress-fill')) $('#mini-progress-fill').style.width = Math.min(100, percent) + '%'
  document.querySelectorAll('[data-time]').forEach(node => { node.textContent = time(elapsed) })
  document.querySelectorAll('[data-total]').forEach(node => { node.textContent = time(duration) })
  document.querySelectorAll('[data-range="seek"]').forEach(node => {
    node.disabled = !known
    node.max = known ? duration : 0
    if (document.activeElement !== node || !node.matches(':active')) node.value = known ? elapsed : 0
    node.style.setProperty('--progress', percent + '%')
  })
}
function updatePlayer() {
  const play = player.state()
  const item = play.track
  $('#player').hidden = !item
  if (!item && ui.modal === 'now' && dialog.open) dialog.close()
  $('#player').innerHTML = `<button class="mini-open" data-action="now" aria-label="Abrir reproductor de la canción actual" ${item ? '' : 'disabled'}></button><div class="now">
    <button class="now-track" data-action="now" ${item ? '' : 'disabled'}>${cover(item)}<span class="track-text"><strong>${escape(item?.title || 'Nada sonando')}</strong><span>${escape(item?.artist || 'Escoge una canción para comenzar')}</span></span></button>
    ${item ? button('heart', 'Favorito', 'favorite-current', `aria-pressed="${isFavorite(item)}"`) : ''}
  </div><div class="center-controls">${controls(play)}${timeline(!item)}</div>
  <div class="player-tools">${button('queue', 'Ver cola', 'show-queue')}${icon('volume')}<input aria-label="Volumen" type="range" data-range="volume" min="0" max="1" step="0.05" value="${audio.volume}"></div>
  <div class="mini-progress" role="presentation"><span id="mini-progress-fill"></span></div>`
  updateProgress()
  if (ui.view === 'queue') renderQueue()
  if (ui.modal === 'now' && dialog.open) renderNow()
}

// ── Diálogos ──────────────────────────────────────────────────────────────
function openModal(name, title, content, className = '') {
  const wasOpen = dialog.open
  if (!wasOpen) priorFocus = document.activeElement
  ui.modal = name
  dialog.className = className
  dialog.setAttribute('aria-label', title)
  const close = name === 'now' ? '' : button('close', 'Cerrar', 'close')
  dialog.innerHTML = `<div class="dialog-head"><h2>${escape(title)}</h2>${close}</div>` + content
  if (!wasOpen) dialog.showModal()
}
function renderNow() {
  const play = player.state()
  if (!play.track) return
  const { track } = play
  openModal('now', 'Sonando ahora', `<div class="now-content">${cover(track, 'now-art')}
    <div class="now-info"><div><h3>${escape(track.title)}</h3><p>${escape(track.artist)}</p></div>${button('heart', 'Favorito', 'favorite-current', `aria-pressed="${isFavorite(track)}"`)}</div>
    ${timeline(false)}${controls(play)}<button class="text-button" data-action="show-queue">${icon('queue')}Ver cola</button></div>`, 'full-player')
  updateProgress()
}
function trackMenu(item) {
  if (!item) return
  ui.selected = item
  const customList = ui.view === 'playlist' && prefs.playlists.some(p => p.id === ui.activePlaylist)
  openModal('track', item.title, `<div class="dialog-list">
    <button data-action="favorite">${icon('heart')}${isFavorite(item) ? 'Quitar de favoritas' : 'Guardar en favoritas'}</button>
    <button data-action="enqueue">${icon('queue')}Añadir a la cola</button>
    <button data-action="choose-list">${icon('add')}Añadir a playlist</button>
    <button data-action="save-artist">${icon('library')}Guardar artista</button>
    ${customList ? '<button data-action="remove-list-track">' + icon('close') + 'Quitar de esta playlist</button>' : ''}
  </div>`)
}
function editPlaylist(item, addTrack = false) {
  openModal(addTrack ? 'create-with-track' : item ? 'rename' : 'create', item ? 'Cambiar nombre' : 'Crear playlist',
    `<form id="playlist-form" class="dialog-form"><label for="list-name">Nombre</label>
    <input required maxlength="60" id="list-name" name="name" value="${escape(item?.name || '')}" placeholder="Mi playlist" autocomplete="off">
    <button class="primary">Guardar</button></form>`)
  $('#list-name').focus()
}
function openSettings() {
  sync.load()
  openModal('settings', 'Ajustes', settingsView({ source: prefs.provider, account: sync.state(), version: APP_VERSION }))
}

// ── Catálogo ──────────────────────────────────────────────────────────────
async function refreshDiscover() {
  const provider = prefs.provider
  const query = ui.homeQuery || (provider === 'youtube' ? forYouQuery(prefs) : '')
  ui.discover = []
  ui.discoverStatus = 'Cargando música…'
  if (ui.view === 'home') render()
  try {
    const incoming = await tracks(provider, query)
    if (prefs.provider !== provider) return
    ui.discover = incoming
    ui.discoverStatus = 'El catálogo no tiene canciones para mostrar.'
  } catch (error) {
    if (prefs.provider !== provider) return
    ui.discoverStatus = error.message
  }
  if (ui.view === 'home' || (ui.view === 'search' && !ui.query.trim())) render()
}
async function search() {
  request?.abort()
  const queryText = ui.query.trim()
  ui.results = []
  ui.searchStatus = queryText ? 'Buscando…' : 'Busca por canción o artista.'
  const update = () => {
    if (ui.view !== 'search') return
    ui.list = ui.results
    $('#search-results').innerHTML = searchResults()
    schedulePreparation()
  }
  update()
  if (!queryText) return
  const controller = new AbortController()
  request = controller
  const timer = setTimeout(() => controller.abort('timeout'), 10000)
  try {
    const found = await tracks(prefs.provider, queryText, controller.signal)
    if (controller.signal.aborted) return
    ui.results = found
    ui.searchStatus = 'No encontramos canciones con ese nombre.'
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason !== 'timeout') return
    ui.searchStatus = controller.signal.reason === 'timeout' ? 'La búsqueda tardó demasiado.' : error.message
  } finally { clearTimeout(timer) }
  update()
}

// ── Biblioteca ────────────────────────────────────────────────────────────
function toggleFavorite(item) {
  if (!item) return
  notify(ops.toggleFavorite(prefs, item))
  persist()
  if (ui.view === 'library' || (ui.view === 'playlist' && ui.activePlaylist === 'favorites')) render()
  else refreshFavorite(item)
}
async function exportLibrary() {
  const result = await deliverBackup(backupFile(libraryOf(prefs), APP_VERSION))
  if (result === 'downloaded') notify('Copia descargada en tu dispositivo')
  if (result === 'shared') notify('Copia lista')
}
async function importLibrary(file) {
  try {
    const incoming = parseBackup(await file.text())
    ops.applyLibrary(prefs, mergeLibraries(libraryOf(prefs), incoming))
    persist()
    dialog.close()
    render()
    notify('Biblioteca importada. Se combinó con la que ya tenías.')
  } catch (error) { notify(error.message) }
}

// ── Cuenta ────────────────────────────────────────────────────────────────
async function submitAccount(form, mode) {
  const values = new FormData(form)
  const error = form.querySelector('.form-error')
  const buttons = form.querySelectorAll('button')
  error.textContent = ''
  buttons.forEach(node => { node.disabled = true })
  try {
    const email = String(values.get('email') || '')
    const password = String(values.get('password') || '')
    await (mode === 'sign-up' ? sync.signUp(email, password) : sync.signIn(email, password))
    notify(mode === 'sign-up' ? 'Cuenta creada. Tu biblioteca se guardará en la nube.' : 'Sesión iniciada')
  } catch (failure) {
    if (form.isConnected) error.textContent = failure.message
  } finally { buttons.forEach(node => { if (node.isConnected) node.disabled = false }) }
}

// ── Acciones ──────────────────────────────────────────────────────────────
const actions = {
  // Navegación
  nav: target => setView(target.dataset.view),
  'library-search': () => setView('search'),
  'open-list': target => setView('playlist', target.dataset.id),
  'show-queue': () => { if (dialog.open) dialog.close(); setView('queue') },
  browse: target => { ui.query = target.dataset.query; setView('search'); search() },
  'artist-search': target => { ui.query = target.dataset.name; setView('search'); search() },
  'home-filter': target => { ui.homeQuery = target.dataset.query; refreshDiscover() },
  'library-filter': target => { ui.libraryFilter = target.dataset.filter; render() },
  'library-sort': () => { prefs.libraryOrder = prefs.libraryOrder === 'name' ? 'recent' : 'name'; persist({ library: false }); render() },
  'library-layout': () => { prefs.libraryLayout = prefs.libraryLayout === 'grid' ? 'list' : 'grid'; persist({ library: false }); render() },

  // Reproductor
  play: (_, item) => { if (item) player.start(item, ui.list) },
  'queue-play': (_, __, index) => player.select(index),
  'remove-queue': (_, __, index) => player.remove(index),
  toggle: () => player.toggle(),
  next: () => player.advance(1),
  prev: () => player.advance(-1),
  shuffle: () => player.shuffle(),
  repeat: () => player.repeat(),
  now: () => renderNow(),
  menu: (_, item) => trackMenu(item),
  close: () => dialog.close(),

  // Biblioteca
  'favorite-current': () => toggleFavorite(player.state().track),
  favorite: () => { dialog.close(); toggleFavorite(ui.selected) },
  enqueue: () => { if (ui.selected) player.add(ui.selected); dialog.close(); notify('Añadida a la cola') },
  'save-artist': () => {
    if (ui.selected?.artist) {
      const { changed, message } = ops.saveArtist(prefs, ui.selected)
      if (changed) persist()
      notify(message)
    }
    dialog.close()
  },
  create: () => editPlaylist(),
  'create-with-track': () => editPlaylist(null, true),
  'choose-list': () => openModal('select-list', 'Añadir a playlist', `<div class="dialog-list">${prefs.playlists.map(p =>
    `<button data-action="append-list" data-id="${escape(p.id)}">${icon('music')}${escape(p.name)}</button>`).join('')}
    <button data-action="create-with-track">${icon('add')}Crear playlist</button></div>`),
  'append-list': target => {
    if (ui.selected) {
      const { changed, message } = ops.addToPlaylist(prefs, target.dataset.id, ui.selected)
      if (changed) { persist(); renderSide() }
      notify(message)
    }
    dialog.close()
  },
  'playlist-options': () => openModal('playlist-options', 'Editar playlist', `<div class="dialog-list">
    <button data-action="rename-list">${icon('music')}Cambiar nombre</button><button data-action="delete-list">${icon('close')}Eliminar playlist</button></div>`),
  'rename-list': () => editPlaylist(prefs.playlists.find(p => p.id === ui.activePlaylist)),
  'delete-list': () => openModal('delete', '¿Eliminar esta playlist?', '<div class="dialog-list"><button data-action="confirm-delete">Eliminar</button><button data-action="close">Cancelar</button></div>'),
  'confirm-delete': () => { ops.deletePlaylist(prefs, ui.activePlaylist); persist(); dialog.close(); setView('library') },
  'remove-list-track': () => {
    if (ui.selected && ops.removeFromPlaylist(prefs, ui.activePlaylist, ui.selected)) persist()
    dialog.close()
    render()
  },

  // Ajustes y cuenta
  settings: () => openSettings(),
  'export-library': () => exportLibrary(),
  'sync-now': () => sync.syncNow(),
  'sign-out': async () => { await sync.signOut(); notify('Sesión cerrada. Tu biblioteca sigue en este teléfono.') }
}

// ── Eventos ───────────────────────────────────────────────────────────────
document.addEventListener('error', event => {
  if (event.target.matches?.('.cover img')) loadNextArtwork(event.target)
}, true)
dialog.addEventListener('close', () => {
  ui.modal = ''
  if (priorFocus?.isConnected) priorFocus.focus()
})
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })

document.addEventListener('input', event => {
  const { target } = event
  if (target.id === 'catalog-search') {
    ui.query = target.value
    request?.abort()
    clearTimeout(timers.debounce)
    timers.debounce = setTimeout(search, 650)
  }
  if (target.dataset.range === 'seek') player.seek(Number(target.value))
  if (target.dataset.range === 'volume') player.volume(Number(target.value))
})
document.addEventListener('change', event => {
  const { target } = event
  if (target.id === 'import-file' && target.files?.[0]) importLibrary(target.files[0])
  if (target.id === 'catalog') {
    prefs.provider = target.value === 'audius' ? 'audius' : 'youtube'
    persist({ library: false })
    renderSide()
    refreshDiscover()
    if (ui.view === 'search') search()
    notify('Catálogo cambiado a ' + providers[prefs.provider])
  }
})
document.addEventListener('submit', event => {
  const form = event.target
  event.preventDefault()
  if (form.id === 'search-form') {
    clearTimeout(timers.debounce)
    search()
  }
  if (form.id === 'account-form') submitAccount(form, event.submitter?.value || 'sign-in')
  if (form.id === 'playlist-form') {
    const name = String(new FormData(form).get('name')).trim()
    if (!name) return
    if (ui.modal === 'rename') ops.renamePlaylist(prefs, ui.activePlaylist, name)
    else {
      const playlist = ops.createPlaylist(prefs, name, ui.modal === 'create-with-track' ? ui.selected : null)
      ui.activePlaylist = playlist.id
      ui.view = 'playlist'
    }
    persist()
    dialog.close()
    render()
  }
})
for (const type of ['pointerdown', 'focusin']) {
  document.addEventListener(type, event => {
    const target = event.target.closest?.('[data-action="play"]')
    const item = target && ui.list[Number(target.dataset.index)]
    if (item) player.prepare(item)
  }, { passive: true })
}
document.addEventListener('click', event => {
  if (event.target.closest('input, select, label.file-button')) return
  const target = event.target.closest('[data-action]')
  if (!target) return
  const index = Number(target.dataset.index)
  actions[target.dataset.action]?.(target, ui.list[index], index)
})

// ── Inicio ────────────────────────────────────────────────────────────────
render()
updatePlayer()
refreshDiscover()
requestPersistence()
audioSources()
sync.start()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let reload = false
  navigator.serviceWorker.register(base + 'sw.js', { updateViaCache: 'none' }).then(registration => {
    function check() {
      registration.update().catch(() => {})
      if (registration.waiting && !player.state().playing && !player.state().loading) {
        reload = Boolean(navigator.serviceWorker.controller)
        registration.waiting.postMessage('activate')
      }
    }
    async function checkVersion() {
      try {
        const response = await fetch(base + 'version.json?t=' + Date.now(), { cache: 'no-store' })
        const { version } = await response.json()
        if (version && version !== APP_VERSION) check()
      } catch { /* Sin conexión: se revisa más tarde. */ }
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reload) return
      reload = false
      notify('Actualizando…')
      setTimeout(() => location.reload(), 400)
    })
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', event => {
        if (event.target.state === 'installed') check()
      })
    })
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { check(); checkVersion() } })
    window.addEventListener('online', check)
    setInterval(checkVersion, 30 * 60 * 1000)
    check()
  }).catch(() => {})
}
