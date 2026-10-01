import { useEffect, useState } from 'react'
import { requestCurrentPosition, type GeolocationResult } from '../../utils/geolocation'

export type { GeolocationResult }

/** One-shot geolocation lookup on mount (spec §6.1/§6.2: geoloc-assisted pin
 * placement). No retry/watch — the pin stays draggable regardless of whether
 * this succeeds, so a failure or a slow/denied permission just leaves the
 * pin at its initial fallback position. */
export function useGeolocation() {
  const [result, setResult] = useState<GeolocationResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // requestCurrentPosition rejects with the browser's GeolocationPositionError
  // (permission denied, timeout, position unavailable) in the normal case, or
  // a plain Error when the API isn't available at all — neither is read by
  // any caller today (only `result`/`isLoading` are), so the wider type
  // covers both without over-claiming shape callers don't get.
  const [error, setError] = useState<GeolocationPositionError | Error | null>(null)

  useEffect(() => {
    let cancelled = false

    requestCurrentPosition()
      .then((position) => {
        if (cancelled) return
        setResult(position)
        setIsLoading(false)
      })
      .catch((geoError: GeolocationPositionError | Error) => {
        if (cancelled) return
        setError(geoError)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { result, isLoading, error }
}
