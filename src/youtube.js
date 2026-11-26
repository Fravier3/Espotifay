let loading
export function youtubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      loading = undefined
      reject(Error('El reproductor de YouTube tardó demasiado. Intenta de nuevo.'))
    }, 15000)
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer)
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => {
      clearTimeout(timer)
      loading = undefined
      reject(Error('No se pudo conectar con YouTube.'))
    }
    document.head.append(script)
  })
  return loading
}

export function youtubePlayer({ change, progress, ended, failure }) {
  let instance
  let ready
  let interval
  let active = false
  function get() {
    if (ready) return ready
    ready = youtubeApi().then(YT => new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ready = undefined
        reject(Error('YouTube no pudo iniciar el reproductor.'))
      }, 15000)
      instance = new YT.Player('youtube-frame', {
        width: '100%', height: '200',
        playerVars: { playsinline: 1, origin: location.origin },
        events: {
          onReady() { clearTimeout(timer); resolve(instance) },
          onStateChange(event) {
            if (!active) return
            change()
            if (event.data === YT.PlayerState.ENDED) ended()
          },
          onError() { if (active) failure('YouTube no puede reproducir esta pista aquí. Prueba otra versión.') }
        }
      })
    }))
    return ready
  }
  return {
    async play(id, shouldPlay = () => true) {
      active = true
      document.querySelector('#youtube-region').hidden = false
      const frame = await get()
      if (!shouldPlay()) return
      frame.loadVideoById(id)
      clearInterval(interval)
      interval = setInterval(() => {
        if (active) progress(frame.getDuration() || 0, frame.getCurrentTime() || 0)
      }, 500)
    },
    stop() {
      active = false
      clearInterval(interval)
      instance?.stopVideo?.()
      document.querySelector('#youtube-region').hidden = true
    },
    toggle() { if (instance?.getPlayerState() === 1) instance.pauseVideo(); else instance?.playVideo() },
    pause() { instance?.pauseVideo() },
    seek(time) { instance?.seekTo(time, true) },
    volume(value) { instance?.setVolume(value * 100) },
    playing() { return active && instance?.getPlayerState?.() === 1 },
    duration() { return instance?.getDuration?.() || 0 },
    currentTime() { return instance?.getCurrentTime?.() || 0 }
  }
}
