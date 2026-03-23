export function qs(selector, root = document) {
  return root.querySelector(selector)
}

export function on(el, eventName, handler, options) {
  el?.addEventListener?.(eventName, handler, options)
  return () => el?.removeEventListener?.(eventName, handler, options)
}

