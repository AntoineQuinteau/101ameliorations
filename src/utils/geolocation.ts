/** Shared shape for a one-shot browser geolocation fix — used by
 * `useGeolocation` (position-step auto-fill), `MapZoomLocateControls`
 * ("Me localiser") and `MapPage`'s "Signaler à ma position", so all three
 * describe the same result instead of each writing out `{ lat; lng;
 * accuracyM }` inline. */
export interface GeolocationResult {
  lat: number
  lng: number
  accuracyM: number
}

const DEFAULT_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000 }

/** Wraps `navigator.geolocation.getCurrentPosition` in a promise and maps
 * its result to `GeolocationResult`, so every call site shares one place
 * that reads `position.coords` — rather than `useGeolocation`,
 * `MapZoomLocateControls` and `MapPage.handleReportHereButton` each writing
 * their own `getCurrentPosition` call. Rejects with the browser's
 * `GeolocationPositionError` on failure/timeout, or a plain `Error` when the
 * API isn't available at all (e.g. non-HTTPS, unsupported browser). */
export function requestCurrentPosition(
  options: PositionOptions = DEFAULT_OPTIONS,
): Promise<GeolocationResult> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation API unavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        })
      },
      reject,
      options,
    )
  })
}
