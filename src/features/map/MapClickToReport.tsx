import { useEffect, useRef } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import type L from 'leaflet'

const LONG_PRESS_MS = 500
// Same tolerance as Leaflet's own tap-hold (Map.TapHold.js, `tapTolerance`):
// a finger always drifts a few pixels, so only a real move cancels the press.
const LONG_PRESS_TOLERANCE_PX = 15

/**
 * Reports a candidate point for "signaler ici" (spec §6.1): click, or
 * long-press. Renders nothing itself — the caller (`MapPage`) turns the picked
 * point into a pin + confirm affordance, the same way `ClusteredKlashMarkers`
 * hands a klash to `KlashPreviewCard`.
 *
 * Leaflet has no long-press event, so it is timed here, differently per input:
 * - Mouse: Leaflet `mousedown` → `mouseup`.
 * - Touch: native `touchstart` → `touchend` on the map container. Leaflet's
 *   `mousedown` can't be used: browsers only emit the compatibility mouse
 *   events (mousedown → mouseup → click) *after* `touchend`, so the timer
 *   would start once the finger is already up and never fire during the press.
 *
 * After a successful long-press, `isLongPressRef` makes the compatibility
 * `click` that may follow it a no-op so the point isn't reported twice. Some
 * browsers send no click at all after a long-press, so the flag is also reset
 * on the next `touchstart` — otherwise it would swallow the next real tap.
 */
export function MapClickToReport({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const map = useMap()
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)
  // Read through a ref so the touch listeners below are bound once per map,
  // even though `MapPage` passes a new inline callback on every render.
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onPickRef.current = onPick
  })

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
    zoomstart: clearPressTimer,
  })

  useEffect(() => {
    const container = map.getContainer()
    let startPoint: L.Point | null = null

    // `mouseEventToContainerPoint` only reads clientX/clientY, which a Touch
    // has too — hence the cast.
    function toContainerPoint(touch: Touch): L.Point {
      return map.mouseEventToContainerPoint(touch as unknown as MouseEvent)
    }

    function onTouchStart(event: TouchEvent) {
      isLongPressRef.current = false
      clearPressTimer()
      // Pinch, or a touch on a marker / control: not a "pick here" gesture.
      if (event.touches.length !== 1) return
      if ((event.target as Element).closest('.leaflet-interactive, .leaflet-control')) return

      const point = toContainerPoint(event.touches[0])
      startPoint = point
      pressTimerRef.current = setTimeout(() => {
        pressTimerRef.current = null
        isLongPressRef.current = true
        const latlng = map.containerPointToLatLng(point)
        onPickRef.current(latlng.lat, latlng.lng)
      }, LONG_PRESS_MS)
    }

    function onTouchMove(event: TouchEvent) {
      if (!pressTimerRef.current || !startPoint) return
      if (
        event.touches.length !== 1 ||
        toContainerPoint(event.touches[0]).distanceTo(startPoint) > LONG_PRESS_TOLERANCE_PX
      ) {
        clearPressTimer()
      }
    }

    // Passive and never preventDefault'ed: Leaflet's drag/pinch handling and
    // the compatibility click after a tap must stay untouched.
    const options = { passive: true }
    container.addEventListener('touchstart', onTouchStart, options)
    container.addEventListener('touchmove', onTouchMove, options)
    container.addEventListener('touchend', clearPressTimer, options)
    container.addEventListener('touchcancel', clearPressTimer, options)
    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', clearPressTimer)
      container.removeEventListener('touchcancel', clearPressTimer)
      clearPressTimer()
    }
  }, [map])

  return null
}
