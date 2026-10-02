import { useEffect, useRef, useState } from 'react'
import type L from 'leaflet'
import { LocateIcon, MinusIcon, PlusIcon } from '../../components/icons'
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
 * conditional rendering) so a tap on "Me localiser" survives whatever
 * caused it to hide — the mobile filters sheet opening on `MapPage`, or the
 * form step starting on `NewKlashPage`. An earlier version unmounted
 * instead (and, to survive *that*, lifted `isLocating` into both parent
 * pages, neither of which otherwise had any use for it); that meant every
 * in-flight request needed its own guard against running after unmount,
 * and those guards were themselves a source of bugs (an `isMountedRef`
 * that's permanently `false` under `<StrictMode>`'s dev-only
 * mount→cleanup→mount, a `.catch` that silently swallowed exceptions
 * thrown from inside the `.then`) — unmounting never actually served a
 * purpose here, since the component renders nothing when hidden either
 * way. `isLocating` is local state again now that nothing needs to
 * preserve it across an unmount that no longer happens. */
export function MapZoomLocateControls({
  map,
  serviceArea,
  onLocate,
  visible = true,
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
  className?: string
}) {
  const { zoom, minZoom, maxZoom } = useMapZoom(map)
  const [locateError, setLocateError] = useState<'unavailable' | 'outOfArea' | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  // Guards `map.flyTo` (an imperative Leaflet call, not a React setState —
  // calling it on a map whose MapContainer has already unmounted and called
  // `map.remove()` throws) against the page this component lives on
  // unmounting while a locate request is still in flight. Set back to
  // `true` in the effect body, not only registered as a cleanup: under
  // `<StrictMode>`'s dev-only mount → cleanup → mount, a cleanup-only
  // assignment leaves this permanently `false` after the very first mount,
  // since nothing ever flips it back to `true` again — every locate in dev
  // (and in Playwright, which drives the dev server) would otherwise be
  // silently discarded here.
  const isMountedRef = useRef(false)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

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

    // request* below is scoped to this call so a second tap (once the
    // button is re-enabled, e.g. by the stuck fallback) starts a fully
    // independent attempt rather than racing shared mutable state.
    let settled = false
    const stuckFallback = setTimeout(() => {
      if (settled) return
      settled = true
      setIsLocating(false)
      setLocateError('unavailable')
    }, LOCATE_STUCK_FALLBACK_MS)

    function finish(outcome: 'ok' | 'unavailable' | 'outOfArea') {
      if (settled) return
      settled = true
      clearTimeout(stuckFallback)
      setIsLocating(false)
      if (outcome !== 'ok') setLocateError(outcome)
    }

    requestCurrentPosition()
      .then((result) => {
        if (settled) return
        // The page this component lives on can unmount while the fix is in
        // flight (navigated away via the profile button, a marker, Annuler…)
        // — MapContainer has then already called map.remove(), and flyTo on
        // a removed map throws. Nothing left to update once that's
        // happened, so this returns without calling finish() at all (a
        // setState on an unmounted tree is a silent no-op in React 18, but
        // there's no reason to even try).
        if (!isMountedRef.current) {
          settled = true
          clearTimeout(stuckFallback)
          return
        }
        if (!isPointInBbox(result.lat, result.lng, serviceArea)) {
          finish('outOfArea')
          return
        }
        // flyTo/onLocate run before finish() clears `settled`: a throw from
        // either (e.g. flyTo on a map mid-teardown) must still reach the
        // catch below, not be swallowed by settled already being true.
        map.flyTo([result.lat, result.lng], Math.max(map.getZoom(), MIN_MAP_ZOOM_ON_LOCATE))
        onLocate?.(result)
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
          className="rounded-none rounded-t-full shadow-none"
        >
          <PlusIcon className="h-5 w-5" />
        </MapControlButton>
        <div className="h-px bg-neutral-200" />
        <MapControlButton
          label={fr.map.controls.zoomOut}
          onClick={() => map?.zoomOut()}
          disabled={!map || atMinZoom}
          className="rounded-none rounded-b-full shadow-none"
        >
          <MinusIcon className="h-5 w-5" />
        </MapControlButton>
      </div>

      <div className="relative">
        <MapControlButton
          label={isLocating ? fr.map.controls.locating : fr.map.controls.locate}
          onClick={handleLocate}
          disabled={isLocating}
        >
          <LocateIcon className={`h-5 w-5 ${isLocating ? 'animate-pulse' : ''}`} />
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
