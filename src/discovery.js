import { cover, escape } from './views.js'
import { topArtists } from './state.js'

export const categories = [
  { title: 'Urbano latino', query: 'reggaeton urbano latino', color: '#68335e' },
  { title: 'Pop', query: 'pop latino éxitos', color: '#315a74' },
  { title: 'Bachata', query: 'bachata éxitos', color: '#8b5331' },
  { title: 'Salsa', query: 'salsa clásicos', color: '#326449' },
  { title: 'Para concentrarte', query: 'música instrumental concentración', color: '#494574' },
  { title: 'Nuevos sonidos', query: 'novedades música latina', color: '#725d29' }
]
const personalColors = ['#1f6b45', '#5b3b7a', '#7a3b4a']

/** Búsqueda de "Para ti": rota cada día entre los artistas que más escuchas. */
export function forYouQuery(prefs, today = new Date()) {
  const artists = topArtists(prefs)
  if (!artists.length) return ''
  const day = Math.floor(today.getTime() / 86_400_000)
  return artists[day % artists.length]
}

/** Pestañas de inicio: generales y, si hay historial, una por artista favorito. */
export function homeFilters(prefs) {
  return [['', 'Para ti'], ['novedades música latina', 'Novedades'], ['reggaeton urbano latino', 'Latino'],
    ...topArtists(prefs, 2).map(name => [name + ' canciones', name])]
}

export function explore(tracks, prefs) {
  const personal = prefs ? topArtists(prefs).map((name, index) => ({
    title: 'Porque escuchas ' + name, query: name, color: personalColors[index]
  })) : []
  const all = [...personal, ...categories]
  return `<section class="explore"><div class="section-head"><h2>Encuentra tu próximo sonido</h2></div>
    <div class="genre-grid">${all.map((category, index) =>
      `<button class="genre-card" style="--genre:${category.color}" data-action="browse" data-query="${escape(category.query)}">
        <strong>${escape(category.title)}</strong>${cover(tracks[index])}<span>Explorar ↗</span>
      </button>`).join('')}</div></section>`
}
