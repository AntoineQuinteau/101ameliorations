/** History state set by the desktop marker click so `/k/:id` renders as a modal over the
 * map instead of the full page (spec §6.3). Any other way of reaching `/k/:id` (direct
 * link, new tab, mobile, other pages) has no such state and gets the full page. */
export const KLASH_OVERLAY_STATE = { klashOverlay: true } as const

export function isKlashOverlayState(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    'klashOverlay' in state &&
    state.klashOverlay === true
  )
}
