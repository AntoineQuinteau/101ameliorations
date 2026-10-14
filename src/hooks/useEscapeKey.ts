import { useEffect, useRef } from 'react'

const handlers: (() => void)[] = []

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') handlers[handlers.length - 1]?.()
}

/** Registers an Escape handler on a stack shared by every overlay: only the most
 * recently registered one runs, so Escape closes one layer at a time (a photo
 * lightbox over the klash modal, say). Returns the unregister function. */
export function pushEscapeHandler(handler: () => void): () => void {
  if (handlers.length === 0) window.addEventListener('keydown', onKeyDown)
  handlers.push(handler)
  return () => {
    const index = handlers.lastIndexOf(handler)
    if (index !== -1) handlers.splice(index, 1)
    if (handlers.length === 0) window.removeEventListener('keydown', onKeyDown)
  }
}

/** Calls `onEscape` when Escape is pressed, for as long as the calling component is
 * mounted and no overlay mounted after it is also listening (see `pushEscapeHandler`).
 * For sheets and overlays that have no other keyboard way out. `onEscape` may change
 * identity on every render without cost: the registered handler always calls the
 * latest one but is only (re)registered once.
 *
 * `enabled` is for an overlay that stays mounted while closed: it takes its place on
 * the stack when it opens, like one that mounts then, and leaves it when it closes —
 * a handler left registered while closed would swallow Escape for whatever is under it. */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  const latestOnEscape = useRef(onEscape)
  useEffect(() => {
    latestOnEscape.current = onEscape
  })

  useEffect(() => {
    if (!enabled) return
    return pushEscapeHandler(() => latestOnEscape.current())
  }, [enabled])
}
