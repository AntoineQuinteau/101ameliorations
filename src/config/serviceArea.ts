import type { Bbox } from '../utils/bbox'

/** Bootstrap fallback for the service area bbox (spec §4), used only for the first
 * render and if `settings` is unreachable — see `useServiceArea()` in this same
 * directory. The row in `settings.service_area_bbox` is authoritative and can be
 * edited without a redeploy; keep this constant roughly in sync so the first frame
 * (before that query resolves) doesn't clamp the map to a stale area. */
export const SERVICE_AREA_BBOX: Bbox = {
  minLat: 42.7,
  minLng: -2.3,
  maxLat: 45.0,
  maxLng: 0.5,
}

/** Initial map view (spec §6.1): centre Bayonne, zoom 10. Deliberately not derived
 * from the service area bbox — this is the centre of where the users are, not the
 * centre of the (much larger) service area, which would otherwise open the map on an
 * empty field near Mont-de-Marsan. */
export const INITIAL_MAP_CENTER: [number, number] = [43.49, -1.47]
export const INITIAL_MAP_ZOOM = 10
// 8, not 9: at 9 a typical viewport can't fit the whole service area's ~2.3° of
// latitude, so with the map's hard pan wall the user could never zoom out to an
// overview. Kept as a compile-time constant (static MapContainer prop, read once at
// mount) even though the bbox itself is now dynamic — see ServiceAreaBounds.
export const MIN_MAP_ZOOM = 8
// Native zoom of each MapTiler tileset (verified against the project's key):
// the streets style tops out at 20, the satellite tileset at 22 — see
// MapTiles.tsx for how each is wired to its own `maxNativeZoom`.
export const MAX_MAP_ZOOM = 20
export const MAX_SATELLITE_MAP_ZOOM = 22
