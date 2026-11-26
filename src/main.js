import './styles.css'
import { loadNextArtwork } from './artwork.js'
import { explore } from './discovery.js'
import { libraryView } from './library.js'
import { key, tracks } from './catalog.js'
import { createPlayer } from './player.js'
import { attachSwipeDismiss } from './swipe-dismiss.js'
import { attachMiniDismiss } from './mini-dismiss.js'
import { button, icon } from './icons.js'
import { load, save } from './storage.js'
import { cards, controls, cover, empty, escape, providers, row, shell, sourceSettings, time, timeline } from './views.js'

const base = import.meta.env.BASE_URL
const $ = selector => document.querySelector(selector)
const data = load()
const prefs = {
  provider: data.catalogVersion === 2 && data.provider === 'audius' ? 'audius' : 'youtube',
  catalogVersion: 2,
  endpoint: typeof data.endpoint === 'string' ? data.endpoint : '',
  favorites: Array.isArray(data.favorites) ? data.favorites : [],
  playlists: Array.isArray(data.playlists) ? data.playlists : [],
  recent: Array.isArray(data.recent) ? data.recent : [],
  artists: Array.isArray(data.artists) ? data.artists : [],
  libraryOrder: data.libraryOrder === 'name' ? 'name' : 'recent',
  libraryLayout: data.libraryLayout === 'grid' ? 'grid' : 'list'
}
let view = 'home'
let libraryFilter = 'all'
let homeQuery = ''
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
let warmTimer
let warmGeneration = 0
const audio = $('#audio')

$('#app').innerHTML = shell(base)
const dialog = $('#dialog')
attachSwipeDismiss(dialog)
const player = createPlayer(audio, {
  standby: $('#upcoming-audio'),
  change: updatePlayer,
  progress: updateProgress,
  failure: notify,
  onTrack(item) {
    prefs.recent = [item, ...prefs.recent.filter(track => key(track) !== key(item))].slice(0, 24)
    persist()
  }
})
attachMiniDismiss($('#player'), () => player.stop())
const songCount = count => count === 1 ? '1 canción' : count + ' canciones'
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
function listStatus(items, status) {
  return items.length ? rows(items) : empty(status)
}
function render() {
  renderSide()
  const el = $('#view')
  if (view === 'home') {
    list = discover
    el.innerHTML = `<div class="content home-content">
      <div class="home-heading"><h1>Escucha a tu ritmo</h1><button class="text-button" data-action="open-list" data-id="recent">${icon('clock')}Historial</button></div>
      <div class="filter-tabs" aria-label="Descubrir música">${[['', 'Para ti'], ['novedades música latina', 'Novedades'], ['reggaeton urbano latino', 'Latino']].map(([value, label]) =>
        `<button data-action="home-filter" data-query="${value}" aria-pressed="${homeQuery === value}">${label}</button>`).join('')}</div>
      <div class="quick-collections"><button data-action="open-list" data-id="favorites"><span class="mini-mark">${icon('heart')}</span>Favoritas</button><button data-action="open-list" data-id="recent"><span class="mini-mark">${icon('clock')}</span>Últimas escuchas</button></div>
      <section class="section"><div class="section-head"><h2>Empieza por aquí</h2>${button('search', 'Buscar música', 'library-search')}</div>
        <div class="start-list">${list.length ? rows(list.slice(0, 3)) : empty(discoverStatus)}</div></section>
      ${list.length ? `<section class="section"><div class="section-head"><h2>En tu frecuencia</h2></div><div class="cards album-shelf">${cards(list.slice(3, 12), 3)}</div></section>
      <section class="section"><div class="section-head"><h2>Más para descubrir</h2></div><div class="cards album-shelf">${cards(list.slice(12), 12)}</div></section>` : ''}
    </div>`
  } else if (view === 'search') {
    list = results
    el.innerHTML = `<div class="content"><div class="page-heading"><h1>Buscar</h1></div>
      <form id="search-form" class="search-form">${icon('search')}<input id="catalog-search" type="search" placeholder="¿Qué quieres escuchar?" aria-label="Canción o artista" value="${escape(query)}" autocomplete="off"><button class="primary" type="submit">Buscar</button></form>
      <div class="search-results" id="search-results" aria-live="polite">${query.trim() ? listStatus(list, searchStatus) : explore(discover)}</div></div>`
  } else if (view === 'library') {
    list = []
    el.innerHTML = libraryView(prefs, libraryFilter, prefs.libraryOrder, prefs.libraryLayout)
  } else if (view === 'playlist') {
    const collection = activePlaylist === 'favorites' ? { name: 'Favoritas', tracks: prefs.favorites } :
      activePlaylist === 'recent' ? { name: 'Historial', tracks: prefs.recent } : prefs.playlists.find(p => p.id === activePlaylist)
    if (!collection) return setView('library')
    const custom = Boolean(collection.id)
    list = collection.tracks
    el.innerHTML = `<div class="content"><button class="text-button" data-action="nav" data-view="library">‹ Tu biblioteca</button>
      <div class="page-heading with-action"><div><h1>${escape(collection.name)}</h1><p>${songCount(list.length)}</p></div>
      <div class="inline">${list.length ? '<button class="primary" data-action="play" data-index="0">' + icon('play') + 'Reproducir</button>' : ''}
      ${custom ? button('more', 'Editar playlist', 'playlist-options') : ''}</div></div><div class="track-list">${listStatus(list, 'Todavía no hay canciones aquí.')}</div></div>`
  } else renderQueue()
  schedulePreparation()
}
function schedulePreparation() {
  clearTimeout(warmTimer)
  const generation = ++warmGeneration
  if (navigator.connection?.saveData) return
  warmTimer = setTimeout(async () => {
    const bounds = $('#view').getBoundingClientRect()
    const current = player.state().track
    const seen = new Set()
    const visible = [...$('#view').querySelectorAll('[data-action="play"]')]
      .filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.bottom > bounds.top && rect.top < bounds.bottom
      })
      .map(element => list[Number(element.dataset.index)])
      .filter(item => item && (!current || key(item) !== key(current)))
      .filter(item => {
        const id = key(item)
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      .slice(0, 8)
    let cursor = 0
    async function worker() {
      while (cursor < visible.length) {
        if (generation !== warmGeneration || player.state().loading) return
        const item = visible[cursor++]
        await player.prepare(item)
      }
    }
    await Promise.all([worker(), worker()])
  }, 150)
}
$('#view').addEventListener('scroll', schedulePreparation, { passive: true })

function renderQueue() {
  const play = player.state()
  const current = play.track
  list = play.queue
  $('#view').innerHTML = `<div class="content"><div class="page-heading"><h1>Cola</h1><p>${songCount(list.length)}</p></div>
    <div class="track-list">${list.length ? list.map((item, index) =>
      row(item, index, current && key(current), isFavorite(item), 'queue-play', index === play.index ? 'menu' : 'remove-queue')).join('') : empty('Reproduce una canción o agrégala a la cola.')}</div></div>`
}

function updateProgress(duration = player.duration(), elapsed = player.currentTime()) {
  const percent = Number.isFinite(duration) && duration > 0 ? elapsed / duration * 100 : 0
  if ($('#mini-progress-fill')) $('#mini-progress-fill').style.width = Math.min(100, percent) + '%'
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
  $('#player').hidden = !item
  if (!item && modal === 'now' && dialog.open) dialog.close()
  $('#player').innerHTML = `<button class="mini-open" data-action="now" aria-label="Abrir reproductor de la canción actual" ${item ? '' : 'disabled'}></button><div class="now">
    <button class="now-track" data-action="now" ${item ? '' : 'disabled'}>${cover(item)}<span class="track-text"><strong>${escape(item?.title || 'Nada sonando')}</strong><span>${escape(item?.artist || 'Escoge una canción para comenzar')}</span></span></button>
    ${item ? button('heart', 'Favorito', 'favorite-current', `aria-pressed="${isFavorite(item)}"`) : ''}
  </div><div class="center-controls">${controls(play)}${timeline(!item)}</div>
  <div class="player-tools">${button('queue', 'Ver cola', 'show-queue')}${icon('volume')}<input aria-label="Volumen" type="range" data-range="volume" min="0" max="1" step="0.05" value="${audio.volume}"></div>`
  $('#player').insertAdjacentHTML('beforeend', '<div class="mini-progress" role="presentation"><span id="mini-progress-fill"></span></div>')
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
  const header = name === 'now' ?
    `<div class="dialog-head"><h2>${escape(title)}</h2></div>` :
    `<div class="dialog-head"><h2>${escape(title)}</h2>${button('close', 'Cerrar', 'close')}</div>`
  dialog.innerHTML = header + content
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
    <button data-action="save-artist">${icon('library')}Guardar artista</button>
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
    const incoming = await tracks(provider, endpoint, homeQuery)
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
      $('#search-results').innerHTML = query.trim() ? listStatus(results, searchStatus) : explore(discover)
      schedulePreparation()
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
  if (event.target.matches?.('.cover img')) loadNextArtwork(event.target)
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
    debounce = setTimeout(search, 650)
  }
  if (target.dataset.range === 'seek') player.seek(Number(target.value))
  if (target.dataset.range === 'volume') player.volume(Number(target.value))
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
      prefs.endpoint = ''
      prefs.provider = values.get('catalog') === 'audius' ? 'audius' : 'youtube'
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
for (const type of ['pointerdown', 'focusin']) {
  document.addEventListener(type, event => {
    const target = event.target.closest('[data-action="play"]')
    if (target && list[Number(target.dataset.index)]) player.prepare(list[Number(target.dataset.index)])
  }, { passive: true })
}
document.addEventListener('click', event => {
  if (event.target.closest('input, select')) return
  const target = event.target.closest('[data-action]')
  if (!target) return
  const { action, id } = target.dataset
  const index = Number(target.dataset.index)
  const item = list[index]
  switch (action) {
    case 'library-search': setView('search'); break
    case 'library-filter': libraryFilter = target.dataset.filter; render(); break
    case 'library-sort': prefs.libraryOrder = prefs.libraryOrder === 'name' ? 'recent' : 'name'; persist(); render(); break
    case 'library-layout': prefs.libraryLayout = prefs.libraryLayout === 'grid' ? 'list' : 'grid'; persist(); render(); break
    case 'browse':
    case 'artist-search':
      query = target.dataset.query || target.dataset.name
      setView('search'); search(); break
    case 'home-filter':
      homeQuery = target.dataset.query
      refreshDiscover(); break
    case 'save-artist':
      if (selected?.artist) {
        const exists = prefs.artists.some(artist => artist.name === selected.artist)
        if (!exists) prefs.artists.unshift({ name: selected.artist, image: selected.image, source: selected.source, id: selected.id })
        persist()
        notify(exists ? 'Este artista ya está guardado' : 'Artista guardado en tu biblioteca')
      }
      dialog.close(); break
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
      if (registration.waiting && !player.state().playing && !player.state().loading) {
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
