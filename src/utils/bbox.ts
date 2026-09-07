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
