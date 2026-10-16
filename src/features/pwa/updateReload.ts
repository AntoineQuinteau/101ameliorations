import { isKlashOverlayState } from '../klash/klashOverlay'

interface RouteLocation {
  pathname: string
  state: unknown
}

/** Whether the navigation from `from` to `to` is a moment to load a new app
 * version that has already taken over (spec §7). True only when the page
 * changes and nothing stays mounted across it, so the reload loses nothing
 * the navigation itself wasn't already dropping. Opening or closing the
 * desktop klash modal keeps the map (viewport, filters) mounted, so those
 * transitions wait for a later one. */
export function isUpdateReloadPoint(from: RouteLocation, to: RouteLocation): boolean {
  if (from.pathname === to.pathname) return false
  return !isKlashOverlayState(from.state) && !isKlashOverlayState(to.state)
}
