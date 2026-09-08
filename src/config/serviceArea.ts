import type { Bbox } from '../utils/bbox'

/** Service area bbox (spec §4): CAPB + sud Landes. Mirrors `settings.service_area_bbox`
 * in the database — kept in sync manually since it rarely changes and the map needs it
 * before any query can run. */
export const SERVICE_AREA_BBOX: Bbox = {
  minLat: 43.25,
  minLng: -1.8,
  maxLat: 43.8,
  maxLng: -0.9,
}

/** Initial map view (spec §6.1): centre Bayonne, zoom 10. */
export const INITIAL_MAP_CENTER: [number, number] = [43.49, -1.47]
export const INITIAL_MAP_ZOOM = 10
export const MIN_MAP_ZOOM = 9
export const MAX_MAP_ZOOM = 18
