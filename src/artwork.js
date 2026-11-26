export function safeImage(value) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : ''
  } catch { return '' }
}

export function artworkSources(track) {
  const original = safeImage(track?.image)
  if (!original) return []
  const url = new URL(original)
  const google = ['lh3.googleusercontent.com', 'yt3.googleusercontent.com', 'lh3.ggpht.com', 'yt3.ggpht.com']
  if (google.includes(url.hostname)) {
    const large = original.replace(/=w\d+-h\d+[^?]*/, '=w1200-h1200-l90-rj')
      .replace(/=s\d+[^?]*/, '=s1200-c')
    return [...new Set([large, original])]
  }
  if (track.source === 'youtube' && ['i.ytimg.com', 'img.youtube.com'].includes(url.hostname) &&
      /^[\w-]{11}$/.test(track.id || '')) {
    return [...new Set([
      `https://i.ytimg.com/vi/${track.id}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`, original
    ])]
  }
  if (track.source === 'audius') return [...new Set([original.replace('/480x480', '/1000x1000').replace('/150x150', '/1000x1000'), original])]
  return [original]
}

export function loadNextArtwork(img) {
  const fallbacks = JSON.parse(img.dataset.fallbacks || '[]')
  const next = fallbacks.shift()
  img.dataset.fallbacks = JSON.stringify(fallbacks)
  if (next) img.src = next
  else img.classList.add('broken')
}
