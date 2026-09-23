import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { MapLayer } from './MapTiles'
import { MAX_MAP_ZOOM, MAX_SATELLITE_MAP_ZOOM } from '../../config/serviceArea'

/** Applies the active layer's zoom ceiling. `<MapContainer maxZoom>` only reads its prop
 * once, at construction (same caveat as `ServiceAreaBounds`'s docblock on `maxBounds`),
 * so `MapPage` passes the higher of the ceilings (`MAX_SATELLITE_MAP_ZOOM`) as the
 * static prop and this component narrows it at runtime via `map.setMaxZoom()`.
 * `cycling` shares the plan layer's ceiling — CyclOSM's own native zoom
 * (`tileProviders.ts`) is the same order of magnitude as the plan style's. Renders
 * nothing. */
export function MapLayerZoom({ layer }: { layer: MapLayer }) {
  const map = useMap()

  useEffect(() => {
    const maxZoom = layer === 'satellite' ? MAX_SATELLITE_MAP_ZOOM : MAX_MAP_ZOOM
    map.setMaxZoom(maxZoom)
    // setMaxZoom alone doesn't recenter a view already zoomed in further than
    // the new ceiling — switching from satellite (22) back to plan (20)
    // while zoomed to 22 would otherwise leave the view stuck past the new
    // limit until the next zoom gesture.
    if (map.getZoom() > maxZoom) map.setZoom(maxZoom)
  }, [map, layer])

  return null
}
