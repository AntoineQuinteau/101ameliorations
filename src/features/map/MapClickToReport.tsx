import { useRef } from 'react'
import { useMapEvents } from 'react-leaflet'
import type L from 'leaflet'

const LONG_PRESS_MS = 500

/**
 * Reports a candidate point for "signaler ici" (spec §6.1): desktop click,
 * or mobile long-press (Leaflet has no long-press event of its own, so it's
 * timed from press-start to press-end). Renders nothing itself — the caller
 * (`MapPage`) turns the picked point into a pin + confirm affordance, the
 * same way `ClusteredKlashMarkers` hands a klash to `KlashPreviewCard`.
 */
export function MapClickToReport({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)

  function clearPressTimer() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  useMapEvents({
    click: (event) => {
      // On touch devices this click fires right after a long-press-triggered
      // pick too; skip it so the point isn't reported twice.
      if (isLongPressRef.current) {
        isLongPressRef.current = false
        return
      }
      onPick(event.latlng.lat, event.latlng.lng)
    },
    mousedown: (event: L.LeafletMouseEvent) => {
      clearPressTimer()
      pressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true
        onPick(event.latlng.lat, event.latlng.lng)
      }, LONG_PRESS_MS)
    },
    mouseup: clearPressTimer,
    dragstart: clearPressTimer,
  })

  return null
}
