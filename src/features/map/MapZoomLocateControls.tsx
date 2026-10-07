import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type L from 'leaflet'
import { Locate, Minus, Plus } from 'lucide-react'
import type { Bbox } from '../../utils/bbox'
import { isPointInBbox } from '../../utils/bbox'
import { requestCurrentPosition, type GeolocationResult } from '../../utils/geolocation'
import { fr } from '../../i18n/fr'
import { MapControlButton } from './MapControlButton'

// A fallback in case neither of getCurrentPosition's own callbacks ever
// fires — e.g. Firefox leaves the request pending forever when the user
// dismisses the permission prompt without choosing, rather than calling the
// error callback. `requestCurrentPosition`'s own PositionOptions.timeout
// only starts counting once permission is granted, so this budget has to
// cover the permission wait too — generous on purpose, since firing while
// the prompt is still up would throw away the real fix that follows it.
const LOCATE_STUCK_FALLBACK_MS = 30_000
const LOCATE_ERROR_DISPLAY_MS = 4_000
// A locate that lands well inside the service area's zoom range but isn't
// distractingly close. Deliberately its own constant, not shared with
// NewKlashPage's NEW_KLASH_MAP_ZOOM (18) or MapPage's INITIAL_MAP_ZOOM (10)
// — both are about where a map *opens*, not about how far a locate should
// zoom in from wherever the map already was.
const MIN_MAP_ZOOM_ON_LOCATE = 16

/** Tracks the map's current zoom against its min/max, so the +/− buttons can
 * disable themselves at the limits instead of doing nothing silently. Also
 * re-reads the limits on `zoomlevelschange` (fired by `map.setMaxZoom()`,
 * e.g. `MapLayerZoom` on a layer switch), not just `zoomend`: when the zoom
 * level itself doesn't change — switching from satellite (22) to plan (20)
 * while below 20 — `setMaxZoom` never fires `zoomend`, and the buttons would
 * otherwise show the previous layer's limits until the next pan/zoom.
 * `map` is nullable because `MapContainer`'s ref callback fires after first
 * render (see MapPage/NewKlashPage). */
function useMapZoom(map: L.Map | null) {
  const [zoom, setZoom] = useState<number | null>(map?.getZoom() ?? null)
  const [minZoom, setMinZoom] = useState<number | null>(map?.getMinZoom() ?? null)
  const [maxZoom, setMaxZoom] = useState<number | null>(map?.getMaxZoom() ?? null)

  useEffect(() => {
    if (!map) return
    const sync = () => {
      setZoom(map.getZoom())
      setMinZoom(map.getMinZoom())
      setMaxZoom(map.getMaxZoom())
    }
    sync()
    map.on('zoomend zoomlevelschange', sync)
    return () => {
      map.off('zoomend zoomlevelschange', sync)
    }
  }, [map])

  return { zoom, minZoom, maxZoom }
}

/** Right-hand column of floating map controls (spec §6.1 follow-up,
 * maps.me-style): zoom in/out, then — separated by a small gap, like
 * maps.me — a "locate me" button. A sibling of `MapContainer`
 * (`absolute … z-[1000]`), not Leaflet's `<ZoomControl>`, so it can share
 * `MapControlButton`'s look with the other controls; `MapPage`/`NewKlashPage`
 * pass `zoomControl={false}` and this replaces it entirely.
 *
 * `map` comes from `MapContainer`'s ref callback rather than `useMap()`:
 * this component (like `MapLayerToggle`) needs to sit *outside*
 * `MapContainer` as a plain positioned sibling, not inside it.
 *
 * Stays mounted even when `visible` is false (hidden with CSS, not
 * conditional rendering), so by default a tap on "Me localiser" survives
 * whatever hid the column — on `MapPage`, the mobile filters sheet opening
 * mid-request still ends with the view on the user once they close it. A
 * page where a late fix would do harm once the column is hidden opts out
 * with `cancelLocateOnHide` (see that prop). Either way, a request still in
 * flight when the page itself unmounts is cancelled, since `flyTo` on a map
 * whose `MapContainer` has by then called `map.remove()` throws. */
export function MapZoomLocateControls({
  map,
  serviceArea,
  onLocate,
  visible = true,
  cancelLocateOnHide = false,
  className = 'absolute right-3 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2',
}: {
  map: L.Map | null
  /** Clamps the locate result to the service area (same check `NewKlashPage`
   * already applies to the pin via `isOutOfArea`): outside it, `flyTo`
   * would animate to a point `ServiceAreaBounds`' `maxBounds` then snaps
   * back from, stranding the "you are here" dot (or, on `/new`, the pin)
   * off screen with no way back except Annuler. */
  serviceArea: Bbox
  onLocate?: (result: GeolocationResult) => void
  /** Hides the column without unmounting it — see the component docblock.
   * `aria-hidden` + `pointer-events-none` keep it out of the a11y tree and
   * unclickable while hidden, matching `DesktopFiltersCard`'s own pattern
   * for the same kind of "present but not currently relevant" panel. */
  visible?: boolean
  /** Drops a request still in flight as soon as `visible` goes false: no
   * `flyTo`, no `onLocate`, the button re-enabled. For `NewKlashPage`, which
   * hides the column once the pin's position is fixed — a fix tapped for
   * before that point must not move the pin after it, nor later (if a
   * photo's position sends the user back to 'duplicates') overwrite a
   * position they chose since. With this set, `onLocate` only ever runs
   * while the column is visible. */
  cancelLocateOnHide?: boolean
  className?: string
}) {
  const { zoom, minZoom, maxZoom } = useMapZoom(map)
  const [locateError, setLocateError] = useState<'unavailable' | 'outOfArea' | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  // Read by handleLocate's async .then instead of its own closure, which
  // would still hold the props from the render the button was tapped in: a
  // fix can take seconds, long enough for useServiceArea's query to replace
  // its compile-time fallback bbox, or for the parent to pass a new
  // onLocate. Synced in a layout effect (not a passive one) so no callback
  // that runs after a commit can still see the previous render's values.
  const latestPropsRef = useRef({ serviceArea, onLocate })
  useLayoutEffect(() => {
    latestPropsRef.current = { serviceArea, onLocate }
  })
  // Settles the request in flight, if any, without applying its result —
  // set by handleLocate, called on unmount and by `cancelLocateOnHide`.
  const cancelPendingLocateRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Also runs (cleanup then setup) on a Fast Refresh that keeps the
    // component mounted — cancelling resets isLocating, so the button isn't
    // left stuck on "Localisation…" by a request whose result is now ignored.
    return () => cancelPendingLocateRef.current?.()
  }, [])

  // A layout effect for the same reason as latestPropsRef: once the commit
  // that hides the column has happened, no fix may still get through.
  useLayoutEffect(() => {
    if (!visible && cancelLocateOnHide) cancelPendingLocateRef.current?.()
  }, [visible, cancelLocateOnHide])

  useEffect(() => {
    if (!locateError) return
    const timer = setTimeout(() => setLocateError(null), LOCATE_ERROR_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [locateError])

  function handleLocate() {
    if (!map) {
      setLocateError('unavailable')
      return
    }
    setIsLocating(true)
    setLocateError(null)

    // Scoped to this call so a second tap (once the button is re-enabled,
    // e.g. by the stuck fallback) starts a fully independent attempt rather
    // than racing shared mutable state.
    let settled = false
    const stuckFallback = setTimeout(() => finish('unavailable'), LOCATE_STUCK_FALLBACK_MS)

    function finish(outcome: 'ok' | 'cancelled' | 'unavailable' | 'outOfArea') {
      if (settled) return
      settled = true
      clearTimeout(stuckFallback)
      setIsLocating(false)
      if (outcome === 'unavailable' || outcome === 'outOfArea') setLocateError(outcome)
    }

    cancelPendingLocateRef.current = () => finish('cancelled')

    requestCurrentPosition()
      .then((result) => {
        if (settled) return
        const { serviceArea: currentServiceArea, onLocate: currentOnLocate } =
          latestPropsRef.current
        if (!isPointInBbox(result.lat, result.lng, currentServiceArea)) {
          finish('outOfArea')
          return
        }
        // flyTo/onLocate run before finish() sets `settled`: a throw from
        // either must still reach the catch below, not be swallowed by
        // settled already being true.
        map.flyTo([result.lat, result.lng], Math.max(map.getZoom(), MIN_MAP_ZOOM_ON_LOCATE))
        currentOnLocate?.(result)
        finish('ok')
      })
      .catch(() => finish('unavailable'))
  }

  const atMaxZoom = zoom !== null && maxZoom !== null && zoom >= maxZoom
  const atMinZoom = zoom !== null && minZoom !== null && zoom <= minZoom

  return (
    <div
      className={className}
      aria-hidden={!visible}
      style={visible ? undefined : { visibility: 'hidden', pointerEvents: 'none' }}
    >
      <div className="flex flex-col overflow-hidden rounded-full shadow-md">
        <MapControlButton
          label={fr.map.controls.zoomIn}
          onClick={() => map?.zoomIn()}
          disabled={!map || atMaxZoom}
          shape="pill-top"
        >
          <Plus className="size-5" />
        </MapControlButton>
        <div className="h-px bg-neutral-200" />
        <MapControlButton
          label={fr.map.controls.zoomOut}
          onClick={() => map?.zoomOut()}
          disabled={!map || atMinZoom}
          shape="pill-bottom"
        >
          <Minus className="size-5" />
        </MapControlButton>
      </div>

      <div className="relative">
        <MapControlButton
          label={isLocating ? fr.map.controls.locating : fr.map.controls.locate}
          onClick={handleLocate}
          disabled={isLocating}
        >
          <Locate className={`size-5 ${isLocating ? 'animate-pulse' : ''}`} />
        </MapControlButton>

        {locateError && (
          <p
            role="status"
            aria-live="polite"
            className="absolute top-1/2 right-full mr-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-xs text-neutral-600 shadow"
          >
            {locateError === 'outOfArea'
              ? fr.map.controls.locateOutOfArea
              : fr.map.controls.locateError}
          </p>
        )}
      </div>
    </div>
  )
}
