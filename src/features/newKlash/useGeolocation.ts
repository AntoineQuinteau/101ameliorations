import { useEffect, useState } from 'react'

export interface GeolocationResult {
  lat: number
  lng: number
  accuracyM: number
}

/** One-shot geolocation lookup on mount (spec §6.1/§6.2: geoloc-assisted pin
 * placement). No retry/watch — the pin stays draggable regardless of whether
 * this succeeds, so a failure or a slow/denied permission just leaves the
 * pin at its initial fallback position. */
export function useGeolocation() {
  const [result, setResult] = useState<GeolocationResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<GeolocationPositionError | null>(null)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setIsLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setResult({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        })
        setIsLoading(false)
      },
      (geoError) => {
        setError(geoError)
        setIsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }, [])

  return { result, isLoading, error }
}
