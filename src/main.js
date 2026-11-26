import './styles.css'
import { key, normalizeEndpoint, tracks } from './catalog.js'
import { createPlayer } from './player.js'
import { button, icon } from './icons.js'
import { load, save } from './storage.js'
import { cards, controls, cover, empty, escape, providers, row, shell, sourceSettings, time, timeline } from './views.js'

const base = import.meta.env.BASE_URL
const $ = selector => document.querySelector(selector)
const data = load()
const prefs = {
  provider: data.provider === 'youtube' ? 'youtube' : 'audius',
  endpoint: typeof data.endpoint === 'string' ? data.endpoint : '',
  favorites: Array.isArray(data.favorites) ? data.favorites : [],
  playlists: Array.isArray(data.playlists) ? data.playlists : [],
  recent: Array.isArray(data.recent) ? data.recent : []
}
let view = 'home'
let activePlaylist = ''
let list = []
let discover = []
let discoverStatus = 'Cargando música…'
let results = []
let searchStatus = 'Busca por canción o artista.'
let query = ''
let selected = null
let request = null
let debounce
let toastTimer
let modal = ''
let priorFocus
const audio = $('#audio')

$('#app').innerHTML = shell(base)
const dialog = $('#dialog')
const player = createPlayer(audio, {
  endpoint: () => prefs.endpoint,
  change: updatePlayer,
  progress: updateProgress,
  failure: notify,
  onTrack(item) {
    prefs.recent = [item, ...prefs.recent.filter(track => key(track) !== key(item))].slice(0, 24)
    persist()
  }
})
const isFavorite = item => prefs.favorites.some(track => key(track) === key(item))

function persist() {
  if (!save(prefs)) notify('El navegador impidió guardar los cambios en este dispositivo.')
}
function notify(message) {
  clearTimeout(toastTimer)
  $('#toast').textContent = message
  $('#toast').classList.add('visible')
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200)
}

function setView(next, playlist = '') {
  view = next
  activePlaylist = playlist
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
    if (item.dataset.view === view || (view === 'playlist' && item.dataset.view === 'library')) item.setAttribute('aria-current', 'page')
    else item.removeAttribute('aria-current')
  })
}
function rows(items) {
  const current = player.state().track
  return items.map((item, index) => row(item, index, current && key(current), isFavorite(item))).join('')
}
function libraryCards() {
  return [
    ['favorites', 'Favoritas', 'heart', prefs.favorites.length], ['recent', 'Historial', 'clock', prefs.recent.length],
    ...prefs.playlists.map(item => [item.id, item.name, 'music', item.tracks.length])
  ].map(([id, title, mark, size]) => `<button class="collection" data-action="open-list" data-id="${escape(id)}">
    <span class="collection-icon mark-${mark}">${icon(mark)}</span><span><strong>${escape(title)}</strong><small>${size} canciones</small></span>${icon('arrow')}</button>`).join('')
}
function listStatus(items, status) {
  return items.length ? rows(items) : empty(status)
}
function render() {
  renderSide()
  const el = $('#view')
  if (view === 'home') {
    list = discover
    const hero = list[0]
    el.innerHTML = `<div class="content">
      <section class="hero ${hero ? '' : 'hero-empty'}">
        <div class="hero-copy">
          <span class="eyebrow">${icon('music')} ${hero ? 'Destacado' : providers[prefs.provider]}</span>
          <h1>${escape(hero?.title || 'Escucha algo nuevo')}</h1>
          <p>${escape(hero?.artist || 'Explora canciones, guarda tus favoritas y arma tu propia cola.')}</p>
          <button class="primary" data-action="${hero ? 'play' : 'nav'}" data-index="0" data-view="search">${icon(hero ? 'play' : 'search')}${hero ? 'Reproducir' : 'Buscar música'}</button>
        </div>${hero ? cover(hero, 'hero-art') : '<div class="hero-disc" aria-hidden="true">' + icon('music') + '</div>'}
      </section>
      <section class="section"><div class="section-head"><h2>En tendencia</h2><span>${providers[prefs.provider]}</span></div>
        ${list.length ? `<div class="cards">${cards(list.slice(0, 6))}</div>` : empty(discoverStatus)}
      </section>
      ${list.length ? `<section class="section"><div class="section-head"><h2>Más para escuchar</h2></div><div class="track-list">${rows(list)}</div></section>` : ''}
    </div>`
  } else if (view === 'search') {
    list = results
    el.innerHTML = `<div class="content"><div class="page-heading"><h1>Buscar</h1><p>${providers[prefs.provider]}</p></div>
      <form id="search-form" class="search-form">${icon('search')}<input id="catalog-search" type="search" placeholder="Canción o artista" aria-label="Canción o artista" value="${escape(query)}" autocomplete="off"><button class="primary" type="submit">Buscar</button></form>
      <div class="track-list search-results" id="search-results" aria-live="polite">${listStatus(list, searchStatus)}</div></div>`
  } else if (view === 'library') {
    list = []
    el.innerHTML = `<div class="content"><div class="page-heading with-action"><div><h1>Tu biblioteca</h1><p>Guardada en este dispositivo</p></div><button class="primary" data-action="create">${icon('add')}Crear playlist</button></div><div class="collections">${libraryCards()}</div></div>`
  } else if (view === 'playlist') {
    const collection = activePlaylist === 'favorites' ? { name: 'Favoritas', tracks: prefs.favorites } :
      activePlaylist === 'recent' ? { name: 'Historial', tracks: prefs.recent } : prefs.playlists.find(p => p.id === activePlaylist)
    if (!collection) return setView('library')
    const custom = Boolean(collection.id)
    list = collection.tracks
    el.innerHTML = `<div class="content"><button class="text-button" data-action="nav" data-view="library">‹ Tu biblioteca</button>
      <div class="page-heading with-action"><div><h1>${escape(collection.name)}</h1><p>${list.length} canciones</p></div>
      <div class="inline">${list.length ? '<button class="primary" data-action="play" data-index="0">' + icon('play') + 'Reproducir</button>' : ''}
      ${custom ? button('more', 'Editar playlist', 'playlist-options') : ''}</div></div><div class="track-list">${listStatus(list, 'Todavía no hay canciones aquí.')}</div></div>`
  } else renderQueue()
}
function renderQueue() {
  const play = player.state()
  const current = play.track
  list = play.queue
  $('#view').innerHTML = `<div class="content"><div class="page-heading"><h1>Cola</h1><p>${list.length} canciones</p></div>
    <div class="track-list">${list.length ? list.map((item, index) =>
      row(item, index, current && key(current), isFavorite(item), 'queue-play', index === play.index ? 'menu' : 'remove-queue')).join('') : empty('Reproduce una canción o agrégala a la cola.')}</div></div>`
}

function updateProgress(duration = audio.duration, elapsed = audio.currentTime) {
  document.querySelectorAll('[data-time]').forEach(node => { node.textContent = time(elapsed) })
  document.querySelectorAll('[data-total]').forEach(node => { node.textContent = time(duration) })
  document.querySelectorAll('[data-range="seek"]').forEach(node => {
    const known = Number.isFinite(duration) && duration > 0
    node.disabled = !known
    node.max = known ? duration : 0
    if (document.activeElement !== node || !node.matches(':active')) node.value = known ? elapsed : 0
    node.style.setProperty('--progress', known ? (elapsed / duration * 100) + '%' : '0%')
  })
}
function updatePlayer() {
  const play = player.state()
  const item = play.track
  $('#player').innerHTML = `<div class="now">
    <button class="now-track" data-action="now" ${item ? '' : 'disabled'}>${cover(item)}<span class="track-text"><strong>${escape(item?.title || 'Nada sonando')}</strong><span>${escape(item?.artist || 'Escoge una canción para comenzar')}</span></span></button>
    ${item ? button('heart', 'Favorito', 'favorite-current', `aria-pressed="${isFavorite(item)}"`) : ''}
  </div><div class="center-controls">${controls(play)}${timeline(!item)}</div>
  <div class="player-tools">${button('queue', 'Ver cola', 'show-queue')}${icon('volume')}<input aria-label="Volumen" type="range" data-range="volume" min="0" max="1" step="0.05" value="${audio.volume}"></div>`
  updateProgress()
  if (view === 'queue') renderQueue()
  if (modal === 'now' && dialog.open) renderNow()
}
function openModal(name, title, content, className = '') {
  const wasOpen = dialog.open
  if (!wasOpen) priorFocus = document.activeElement
  modal = name
  dialog.className = className
  dialog.setAttribute('aria-label', title)
  dialog.innerHTML = `<div class="dialog-head"><h2>${escape(title)}</h2>${button('close', 'Cerrar', 'close')}</div>${content}`
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
  selected = item
  const customList = view === 'playlist' && prefs.playlists.some(p => p.id === activePlaylist)
  openModal('track', item.title, `<div class="dialog-list">
    <button data-action="favorite">${icon('heart')}${isFavorite(item) ? 'Quitar de favoritas' : 'Guardar en favoritas'}</button>
    <button data-action="enqueue">${icon('queue')}Añadir a la cola</button>
    <button data-action="choose-list">${icon('add')}Añadir a playlist</button>
    ${customList ? '<button data-action="remove-list-track">' + icon('close') + 'Quitar de esta playlist</button>' : ''}
  </div>`)
}
function editPlaylist(item, addTrack = false) {
  openModal(addTrack ? 'create-with-track' : item ? 'rename' : 'create', item ? 'Cambiar nombre' : 'Crear playlist',
    `<form id="playlist-form" class="dialog-form"><label for="list-name">Nombre</label>
    <input required maxlength="60" id="list-name" name="name" value="${escape(item?.name || '')}" placeholder="Mi playlist">
    <button class="primary">Guardar</button></form>`)
  $('#list-name').focus()
}

async function refreshDiscover() {
  const provider = prefs.provider
  const endpoint = prefs.endpoint
  discover = []
  discoverStatus = 'Cargando música…'
  if (view === 'home') render()
  try {
    const incoming = await tracks(provider, endpoint)
    if (prefs.provider !== provider || prefs.endpoint !== endpoint) return
    discover = incoming
    discoverStatus = 'El catálogo no tiene canciones para mostrar.'
  } catch (error) {
    if (prefs.provider !== provider || prefs.endpoint !== endpoint) return
    discoverStatus = error.message
  }
  if (view === 'home') render()
}
async function search() {
  request?.abort()
  const queryText = query.trim()
  results = []
  searchStatus = queryText ? 'Buscando…' : 'Busca por canción o artista.'
  const update = () => {
    if (view === 'search') {
      list = results
      $('#search-results').innerHTML = listStatus(results, searchStatus)
    }
  }
  update()
  if (!queryText) return
  const controller = new AbortController()
  request = controller
  try {
    const timer = setTimeout(() => controller.abort('timeout'), 10000)
    try {
      const found = await tracks(prefs.provider, prefs.endpoint, queryText, controller.signal)
      if (controller.signal.aborted) return
      results = found
    } finally { clearTimeout(timer) }
    searchStatus = 'No encontramos canciones con ese nombre.'
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason !== 'timeout') return
    searchStatus = controller.signal.reason === 'timeout' ? 'La búsqueda tardó demasiado.' : error.message
  }
  update()
}
function toggleFavorite(item) {
  if (!item) return
  const hadIt = isFavorite(item)
  prefs.favorites = hadIt ? prefs.favorites.filter(track => key(track) !== key(item)) : [item, ...prefs.favorites]
  persist()
  if (view !== 'search') render()
  updatePlayer()
  notify(hadIt ? 'Quitada de favoritas' : 'Guardada en favoritas')
}

document.addEventListener('error', event => {
  if (event.target.matches?.('.cover img')) event.target.classList.add('broken')
}, true)

dialog.addEventListener('close', () => {
  modal = ''
  if (priorFocus?.isConnected) priorFocus.focus()
})
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
document.addEventListener('input', event => {
  const { target } = event
  if (target.id === 'catalog-search') {
    query = target.value
    request?.abort()
    clearTimeout(debounce)
    debounce = setTimeout(search, 350)
  }
  if (target.dataset.range === 'seek' && Number.isFinite(audio.duration)) audio.currentTime = Number(target.value)
  if (target.dataset.range === 'volume') audio.volume = Number(target.value)
})
document.addEventListener('submit', event => {
  const form = event.target
  event.preventDefault()
  if (form.id === 'search-form') {
    clearTimeout(debounce)
    search()
  }
  if (form.id === 'settings-form') {
    const values = new FormData(form)
    try {
      const endpoint = normalizeEndpoint(values.get('endpoint'))
      if (values.get('catalog') === 'youtube' && !endpoint) throw Error('Indica el servidor para activar YouTube Music.')
      prefs.endpoint = endpoint
      prefs.provider = values.get('catalog')
      persist()
      dialog.close()
      renderSide()
      refreshDiscover()
      if (view === 'search') search()
    } catch (error) { form.querySelector('.form-error').textContent = error.message }
  }
  if (form.id === 'playlist-form') {
    const name = String(new FormData(form).get('name')).trim()
    if (!name) return
    const item = prefs.playlists.find(p => p.id === activePlaylist)
    if (modal === 'rename' && item) item.name = name
    else {
      const playlist = { id: crypto.randomUUID(), name, tracks: modal === 'create-with-track' && selected ? [selected] : [] }
      prefs.playlists.push(playlist)
      setView('playlist', playlist.id)
    }
    persist()
    dialog.close()
    render()
  }
})
document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]')
  if (!target) return
  const { action, id } = target.dataset
  const index = Number(target.dataset.index)
  const item = list[index]
  switch (action) {
    case 'nav': setView(target.dataset.view); break
    case 'open-list': setView('playlist', id); break
    case 'play': if (item) player.start(item, list); break
    case 'queue-play': player.select(index); break
    case 'remove-queue': player.remove(index); break
    case 'show-queue': if (dialog.open) dialog.close(); setView('queue'); break
    case 'toggle': player.toggle(); break
    case 'next': player.advance(1); break
    case 'prev': player.advance(-1); break
    case 'shuffle': player.shuffle(); break
    case 'repeat': player.repeat(); break
    case 'now': renderNow(); break
    case 'menu': trackMenu(item); break
    case 'settings': openModal('settings', 'Ajustes', sourceSettings(prefs.provider, prefs.endpoint)); break
    case 'close': dialog.close(); break
    case 'favorite-current': toggleFavorite(player.state().track); break
    case 'favorite': dialog.close(); toggleFavorite(selected); break
    case 'enqueue': if (selected) player.add(selected); dialog.close(); notify('Añadida a la cola'); break
    case 'create': editPlaylist(); break
    case 'create-with-track': editPlaylist(null, true); break
    case 'choose-list':
      openModal('select-list', 'Añadir a playlist', `<div class="dialog-list">${prefs.playlists.map(p =>
        `<button data-action="append-list" data-id="${escape(p.id)}">${icon('music')}${escape(p.name)}</button>`).join('')}
        <button data-action="create-with-track">${icon('add')}Crear playlist</button></div>`)
      break
    case 'append-list': {
      const playlist = prefs.playlists.find(p => p.id === id)
      if (playlist && selected) {
        if (playlist.tracks.some(track => key(track) === key(selected))) notify('La canción ya está en esta playlist')
        else { playlist.tracks.push(selected); persist(); notify('Añadida a ' + playlist.name) }
      }
      dialog.close()
      if (view !== 'search') render()
      break
    }
    case 'playlist-options':
      openModal('playlist-options', 'Editar playlist', `<div class="dialog-list">
        <button data-action="rename-list">${icon('music')}Cambiar nombre</button><button data-action="delete-list">${icon('close')}Eliminar playlist</button></div>`)
      break
    case 'rename-list': editPlaylist(prefs.playlists.find(p => p.id === activePlaylist)); break
    case 'delete-list': openModal('delete', '¿Eliminar esta playlist?', '<div class="dialog-list"><button data-action="confirm-delete">Eliminar</button><button data-action="close">Cancelar</button></div>'); break
    case 'confirm-delete':
      prefs.playlists = prefs.playlists.filter(p => p.id !== activePlaylist)
      persist(); dialog.close(); setView('library'); break
    case 'remove-list-track': {
      const playlist = prefs.playlists.find(p => p.id === activePlaylist)
      if (playlist && selected) { playlist.tracks = playlist.tracks.filter(track => key(track) !== key(selected)); persist() }
      dialog.close(); render()
      break
    }
  }
})

render()
updatePlayer()
refreshDiscover()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let reload = false
  navigator.serviceWorker.register(base + 'sw.js').then(registration => {
    function check() {
      registration.update().catch(() => {})
      if (registration.waiting && audio.paused) {
        reload = Boolean(navigator.serviceWorker.controller)
        registration.waiting.postMessage('activate')
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reload) location.reload() })
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', event => {
        if (event.target.state === 'installed') check()
      })
    })
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
    window.addEventListener('online', check)
    check()
  }).catch(() => {})
}
