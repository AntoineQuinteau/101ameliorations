export interface Bbox {
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
}

/** True when the WGS84 point (lat, lng) lies within the (inclusive) bounding box. */
export function isPointInBbox(lat: number, lng: number, bbox: Bbox): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng
}

/** Grows a bbox by `factor` of its own width/height on every side (e.g. 0.25 = +25%
 * each way), so data is fetched slightly beyond the visible viewport. */
export function expandBbox(bbox: Bbox, factor: number): Bbox {
  const latPad = (bbox.maxLat - bbox.minLat) * factor
  const lngPad = (bbox.maxLng - bbox.minLng) * factor
  return {
    minLat: bbox.minLat - latPad,
    minLng: bbox.minLng - lngPad,
    maxLat: bbox.maxLat + latPad,
    maxLng: bbox.maxLng + lngPad,
  }
}

/** Snaps a bbox outwards onto a grid of `decimals` places, so nearby viewports collapse
 * onto the same value and reuse the same query cache entry instead of refetching on every
 * pixel of pan.
 *
 * Mins round down and maxes round up rather than every bound rounding to nearest: at 2
 * decimals the grid is ~1.1 km, so a viewport narrower than that (zoom >= 17 on a phone,
 * >= 18 on a desktop) had both bounds land on the same value, producing a zero-area bbox
 * that matched no klash at all — the map went empty at high zoom. Snapping outwards can
 * only ever grow the box, never close it. */
export function roundBbox(bbox: Bbox, decimals: number): Bbox {
  const factor = 10 ** decimals
  const floor = (n: number) => Math.floor(n * factor) / factor
  const ceil = (n: number) => Math.ceil(n * factor) / factor
  return {
    minLat: floor(bbox.minLat),
    minLng: floor(bbox.minLng),
    maxLat: ceil(bbox.maxLat),
    maxLng: ceil(bbox.maxLng),
  }
}

/** Clamps a bbox so it never extends past `bounds` (the service area). */
export function clampBbox(bbox: Bbox, bounds: Bbox): Bbox {
  return {
    minLat: Math.max(bbox.minLat, bounds.minLat),
    minLng: Math.max(bbox.minLng, bounds.minLng),
    maxLat: Math.min(bbox.maxLat, bounds.maxLat),
    maxLng: Math.min(bbox.maxLng, bounds.maxLng),
  }
}

/** Stable string key for a bbox, suitable as a TanStack Query key segment. */
export function bboxKey(bbox: Bbox): string {
  return `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`
}
