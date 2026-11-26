import { cover, escape } from './views.js'

export const categories = [
  { title: 'Urbano latino', query: 'reggaeton urbano latino', color: '#68335e' },
  { title: 'Pop', query: 'pop latino éxitos', color: '#315a74' },
  { title: 'Bachata', query: 'bachata éxitos', color: '#8b5331' },
  { title: 'Salsa', query: 'salsa clásicos', color: '#326449' },
  { title: 'Para concentrarte', query: 'música instrumental concentración', color: '#494574' },
  { title: 'Nuevos sonidos', query: 'novedades música latina', color: '#725d29' }
]

export function explore(tracks) {
  return `<section class="explore"><div class="section-head"><h2>Encuentra tu próximo sonido</h2></div>
    <div class="genre-grid">${categories.map((category, index) =>
      `<button class="genre-card" style="--genre:${category.color}" data-action="browse" data-query="${escape(category.query)}">
        <strong>${category.title}</strong>${cover(tracks[index])}<span>Explorar ↗</span>
      </button>`).join('')}</div></section>`
}
