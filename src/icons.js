const icons = {
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  sort: '<path d="M6 3v18m-3-3 3 3 3-3M13 6h8m-8 6h6m-6 6h4"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  library: '<path d="M4 4v16M9 4v16m5-15 5 14"/>',
  queue: '<path d="M4 5h16M4 10h16M4 15h10m2 2 4 2-4 2z"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  play: '<path fill="currentColor" stroke="none" d="m8 4 13 8-13 8z"/>',
  pause: '<path stroke-width="3.5" d="M8 5v14m8-14v14"/>',
  next: '<path fill="currentColor" stroke="none" d="m5 5 11 7-11 7z"/><path d="M18 5v14"/>',
  prev: '<path fill="currentColor" stroke="none" d="m19 5-11 7 11 7z"/><path d="M6 5v14"/>',
  heart: '<path d="M20.8 4.9a5.1 5.1 0 0 0-7.2 0L12 6.5l-1.6-1.6a5.1 5.1 0 0 0-7.2 7.2l1.6 1.6 7.2 7.2 7.2-7.2 1.6-1.6a5.1 5.1 0 0 0 0-7.2z"/>',
  shuffle: '<path d="M3 6h3l12 12h3m-3-3 3 3-3 3M3 18h3l3-3m6-6 3-3h3m-3-3 3 3-3 3"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
  music: '<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18.5" rx="3" ry="2.5"/><ellipse cx="17" cy="16.5" rx="3" ry="2.5"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2" fill="#111214"/><circle cx="16" cy="17" r="2" fill="#111214"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  down: '<path d="m5 9 7 7 7-7"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  volume: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9a4 4 0 0 1 0 6m3-8a7 7 0 0 1 0 10"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>'
}
export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`
}
export function button(name, label, action, extra = '', className = '') {
  return `<button type="button" class="icon ${className}" aria-label="${label}" title="${label}" data-action="${action}" ${extra}>${icon(name)}</button>`
}
