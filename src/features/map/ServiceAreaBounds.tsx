import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { expandBbox, type Bbox } from '../../utils/bbox'

/** Applies the service area as the map's pan limit. `<MapContainer maxBounds>` only
 * reads its `maxBounds` prop once, at construction (react-leaflet caches the initial
 * options in a ref-callback that never re-runs) — so a bbox that arrives after mount
 * (the runtime value from `useServiceArea()`, replacing the compile-time fallback)
 * would otherwise be silently ignored. This component drives Leaflet imperatively
 * instead, the same pattern as `BboxWatcher`/`PendingPinMarker` in this directory.
 * Renders nothing. */
export function ServiceAreaBounds({ bbox }: { bbox: Bbox }) {
  const map = useMap()

  useEffect(() => {
    const padded = expandBbox(bbox, 0.1)
    map.setMaxBounds([
      [padded.minLat, padded.minLng],
      [padded.maxLat, padded.maxLng],
    ])
    // setMaxBounds only constrains future movement — if the new bbox is narrower
    // than the one the map was constructed with and the current view sits outside
    // it, the view stays out of bounds until the next drag without this.
    map.panInsideBounds(map.getBounds(), { animate: false })
  }, [map, bbox])

  return null
}
