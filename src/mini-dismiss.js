export function attachMiniDismiss(element, onDismiss) {
  let gesture = null
  let blockClickUntil = 0

  function reset() {
    gesture = null
    element.style.removeProperty('transform')
    element.style.removeProperty('opacity')
    element.classList.remove('is-sliding')
  }

  element.addEventListener('pointerdown', event => {
    if (element.hidden || !event.isPrimary || event.target.closest('input')) return
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), distance: 0 }
  })
  element.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) return reset()
    gesture.distance = Math.max(0, -dx)
    if (dx >= -8) {
      element.style.removeProperty('transform')
      element.style.removeProperty('opacity')
      return
    }
    if (!element.hasPointerCapture(event.pointerId)) element.setPointerCapture(event.pointerId)
    event.preventDefault()
    element.classList.add('is-sliding')
    element.style.transform = `translateX(${dx}px)`
    element.style.opacity = String(Math.max(0.25, 1 + dx / element.clientWidth))
  }, { passive: false })
  element.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return
    const distance = gesture.distance
    const velocity = distance / Math.max(1, performance.now() - gesture.started)
    const threshold = Math.min(100, element.clientWidth * 0.25)
    const dismiss = distance >= threshold || (distance >= 35 && velocity >= 0.55)
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
    reset()
    if (distance > 8) blockClickUntil = performance.now() + 300
    if (dismiss) onDismiss()
  })
  element.addEventListener('pointercancel', reset)
  document.addEventListener('click', event => {
    if (performance.now() > blockClickUntil) return
    blockClickUntil = 0
    event.preventDefault()
    event.stopImmediatePropagation()
  }, { capture: true })
}
