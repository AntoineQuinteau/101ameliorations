import { useEffect, useRef, useState } from 'react'
import type L from 'leaflet'
import { LocateIcon, MinusIcon, PlusIcon } from '../../components/icons'
import type { Bbox } from '../../utils/bbox'
import { isPointInBbox } from '../../utils/bbox'
import { requestCurrentPosition, type GeolocationResult } from '../../utils/geolocation'
import { fr } from '../../i18n/fr'
import { MapControlButton } from './MapControlButton'

const LOCATE_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000 }
// A fallback in case neither of getCurrentPosition's own callbacks ever
// fires — e.g. Firefox leaves the request pending forever when the user
// dismisses the permission prompt without choosing, rather than calling the
// error callback. A few seconds past the API's own `timeout` above, which
// only starts counting once permission is granted.
const LOCATE_STUCK_FALLBACK_MS = 15_000
const LOCATE_ERROR_DISPLAY_MS = 4_000
// A locate that lands well inside the service area's zoom range but isn't
// distractingly close, the same zoom `MapPage.handleReportHereButton`'s
// equivalent flow lands users at — not `NewKlashPage`'s own
// NEW_KLASH_MAP_ZOOM (18, MAX_MAP_ZOOM - 2), which is a different, more
// zoomed-in constant for a different purpose (framing the draggable pin).
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
 * `isLocating` is a controlled prop, not local state: this component can
 * unmount mid-request (e.g. `MapPage` hides it behind `isFiltersOpen`), and
 * local state would silently forget an in-flight request on remount, letting
 * a second tap start a parallel one. The caller owns it instead, alongside
 * `onLocate`. */
export function MapZoomLocateControls({
  map,
  serviceArea,
  isLocating,
  onLocatingChange,
  onLocate,
  className = 'absolute right-3 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2',
}: {
  map: L.Map | null
  /** Clamps the locate result to the service area (same check `NewKlashPage`
   * already applies to the pin via `isOutOfArea`): outside it, `flyTo`
   * would animate to a point `ServiceAreaBounds`' `maxBounds` then snaps
   * back from, stranding the "you are here" dot (or, on `/new`, the pin)
   * off screen with no way back except Annuler. */
  serviceArea: Bbox
  isLocating: boolean
  onLocatingChange: (isLocating: boolean) => void
  onLocate?: (result: GeolocationResult) => void
  className?: string
}) {
  const { zoom, minZoom, maxZoom } = useMapZoom(map)
  const [locateError, setLocateError] = useState<'unavailable' | 'outOfArea' | null>(null)
  // Guards the async geolocation callback against running after this
  // component has unmounted (map.remove() already ran — see handleLocate).
  const isMountedRef = useRef(true)
  useEffect(
    () => () => {
      isMountedRef.current = false
    },
    [],
  )

  useEffect(() => {
    if (!locateError) return
    const timer = setTimeout(() => setLocateError(null), LOCATE_ERROR_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [locateError])

  function handleLocate() {
    if (!map || !navigator.geolocation) {
      setLocateError('unavailable')
      return
    }
    onLocatingChange(true)
    setLocateError(null)

    let settled = false
    const stuckFallback = setTimeout(() => {
      if (settled) return
      settled = true
      onLocatingChange(false)
      setLocateError('unavailable')
    }, LOCATE_STUCK_FALLBACK_MS)

    requestCurrentPosition(LOCATE_OPTIONS)
      .then((result) => {
        if (settled) return
        settled = true
        clearTimeout(stuckFallback)
        // The request can outlive this component (e.g. the user navigated
        // away while the fix was in flight) — MapContainer has then already
        // called map.remove(), and flyTo on a removed map throws.
        if (!isMountedRef.current || !map) return
        if (!isPointInBbox(result.lat, result.lng, serviceArea)) {
          onLocatingChange(false)
          setLocateError('outOfArea')
          return
        }
        map.flyTo([result.lat, result.lng], Math.max(map.getZoom(), MIN_MAP_ZOOM_ON_LOCATE))
        onLocate?.(result)
        onLocatingChange(false)
      })
      .catch(() => {
        if (settled) return
        settled = true
        clearTimeout(stuckFallback)
        if (!isMountedRef.current) return
        onLocatingChange(false)
        setLocateError('unavailable')
      })
  }

  const atMaxZoom = zoom !== null && maxZoom !== null && zoom >= maxZoom
  const atMinZoom = zoom !== null && minZoom !== null && zoom <= minZoom

  return (
    <div className={className}>
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
          <p className="absolute top-1/2 right-full mr-2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-xs text-neutral-600 shadow">
            {locateError === 'outOfArea'
              ? fr.map.controls.locateOutOfArea
              : fr.map.controls.locateError}
          </p>
        )}
      </div>
    </div>
  )
}
