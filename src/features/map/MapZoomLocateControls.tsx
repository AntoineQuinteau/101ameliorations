import { useEffect, useState } from 'react'
import type L from 'leaflet'
import { LocateIcon, MinusIcon, PlusIcon } from '../../components/icons'
import { fr } from '../../i18n/fr'
import { MapControlButton } from './MapControlButton'

const LOCATE_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000 }
// A locate that lands well inside the service area's zoom range but isn't
// distractingly close — matches the "recentre" zoom NewKlashPage already
// uses for its own pin placement.
const LOCATE_MIN_ZOOM = 16
const LOCATE_ERROR_DISPLAY_MS = 4_000

/** Tracks the map's current zoom against its min/max, so the +/− buttons can
 * disable themselves at the limits instead of doing nothing silently.
 * `map` is nullable because `MapContainer`'s ref callback fires after first
 * render (see MapPage/NewKlashPage). */
function useMapZoom(map: L.Map | null) {
  const [zoom, setZoom] = useState<number | null>(map?.getZoom() ?? null)

  useEffect(() => {
    if (!map) return
    setZoom(map.getZoom())
    const onZoom = () => setZoom(map.getZoom())
    map.on('zoomend', onZoom)
    return () => {
      map.off('zoomend', onZoom)
    }
  }, [map])

  return zoom
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
 * `MapContainer` as a plain positioned sibling, not inside it. */
export function MapZoomLocateControls({
  map,
  onLocate,
  className = 'absolute right-3 top-1/2 z-[1000] flex -translate-y-1/2 flex-col gap-2',
}: {
  map: L.Map | null
  onLocate?: (result: { lat: number; lng: number; accuracyM: number }) => void
  className?: string
}) {
  const zoom = useMapZoom(map)
  const [isLocating, setIsLocating] = useState(false)
  const [locateError, setLocateError] = useState(false)

  useEffect(() => {
    if (!locateError) return
    const timer = setTimeout(() => setLocateError(false), LOCATE_ERROR_DISPLAY_MS)
    return () => clearTimeout(timer)
  }, [locateError])

  function handleLocate() {
    if (!map || !navigator.geolocation) {
      setLocateError(true)
      return
    }
    setIsLocating(true)
    setLocateError(false)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng, accuracy: accuracyM } = position.coords
        map.flyTo([lat, lng], Math.max(map.getZoom(), LOCATE_MIN_ZOOM))
        onLocate?.({ lat, lng, accuracyM })
        setIsLocating(false)
      },
      () => {
        setIsLocating(false)
        setLocateError(true)
      },
      LOCATE_OPTIONS,
    )
  }

  const atMaxZoom = zoom !== null && map !== null && zoom >= map.getMaxZoom()
  const atMinZoom = zoom !== null && map !== null && zoom <= map.getMinZoom()

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
            {fr.map.controls.locateError}
          </p>
        )}
      </div>
    </div>
  )
}
