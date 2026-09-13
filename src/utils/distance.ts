const EARTH_RADIUS_M = 6_371_000

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Great-circle distance in metres between two WGS84 points (haversine
 * formula). Used to compare a photo's EXIF GPS position against the pin
 * (spec §6.2 step 3). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}
