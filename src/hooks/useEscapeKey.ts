import { useEffect, useRef } from 'react'

/** Calls `onEscape` whenever Escape is pressed anywhere in the window, for as
 * long as the calling component is mounted. For sheets and overlays that have
 * no other keyboard way out. `onEscape` may change identity on every render
 * without cost: the listener always calls the latest one but is only
 * (re)subscribed once. */
export function useEscapeKey(onEscape: () => void): void {
  const latestOnEscape = useRef(onEscape)
  useEffect(() => {
    latestOnEscape.current = onEscape
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') latestOnEscape.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
