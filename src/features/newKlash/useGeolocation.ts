import { useEffect, useState } from 'react'
import { requestCurrentPosition, type GeolocationResult } from '../../utils/geolocation'

/** One-shot geolocation lookup on mount (spec §6.1/§6.2: geoloc-assisted pin
 * placement). No retry/watch — the pin stays draggable regardless of whether
 * this succeeds, so a failure or a slow/denied permission just leaves the
 * pin at its initial fallback position. No `error` in the return value:
 * nothing has ever read one (only `result`/`isLoading` are consumed), and a
 * failure already shows up as `isLoading` going `false` with `result` still
 * `null` — add it back if a caller actually needs to show a GeolocationPositionError's
 * detail.
 *
 * `enabled: false` skips the lookup entirely — and with it the browser's
 * permission prompt — for a caller that already knows it would discard the
 * fix (a pin placed by hand, a restored draft). */
export function useGeolocation(enabled = true) {
  const [result, setResult] = useState<GeolocationResult | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    requestCurrentPosition()
      .then((position) => {
        if (cancelled) return
        setResult(position)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { result, isLoading }
}
