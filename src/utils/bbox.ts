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

/** Rounds every bound to `decimals` places, so nearby viewports collapse onto the same
 * value and reuse the same query cache entry instead of refetching on every pixel of pan. */
export function roundBbox(bbox: Bbox, decimals: number): Bbox {
  const factor = 10 ** decimals
  const round = (n: number) => Math.round(n * factor) / factor
  return {
    minLat: round(bbox.minLat),
    minLng: round(bbox.minLng),
    maxLat: round(bbox.maxLat),
    maxLng: round(bbox.maxLng),
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
