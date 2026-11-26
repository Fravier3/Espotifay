export function attachSwipeDismiss(dialog) {
  let gesture = null
  let blockClickUntil = 0

  function reset() {
    gesture = null
    dialog.style.removeProperty('transform')
    dialog.classList.remove('is-dragging')
  }

  dialog.addEventListener('pointerdown', event => {
    if (!dialog.open || !dialog.matches('.full-player') || !event.isPrimary ||
        !event.target.closest('.dialog-head, .now-art')) return
    if (dialog.scrollTop > 0 && !event.target.closest('.dialog-head')) return
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, started: performance.now(), distance: 0 }
  })

  dialog.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) return reset()
    if (dy <= 8) return
    if (!dialog.hasPointerCapture(event.pointerId)) dialog.setPointerCapture(event.pointerId)
    event.preventDefault()
    gesture.distance = dy
    dialog.classList.add('is-dragging')
    dialog.style.transform = `translateY(${dy}px)`
  }, { passive: false })

  dialog.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return
    const distance = gesture.distance
    const velocity = distance / Math.max(1, performance.now() - gesture.started)
    const shouldClose = distance >= 90 || (distance >= 35 && velocity >= 0.55)
    if (dialog.hasPointerCapture(event.pointerId)) dialog.releasePointerCapture(event.pointerId)
    reset()
    if (distance > 8) blockClickUntil = performance.now() + 300
    if (shouldClose) dialog.close()
  })

  dialog.addEventListener('scroll', () => {
    dialog.classList.toggle('is-scrolled', dialog.scrollTop > 0)
  }, { passive: true })
  dialog.addEventListener('pointercancel', reset)
  dialog.addEventListener('close', reset)
  document.addEventListener('click', event => {
    if (performance.now() > blockClickUntil) return
    blockClickUntil = 0
    event.preventDefault()
    event.stopImmediatePropagation()
  }, { capture: true })
}
