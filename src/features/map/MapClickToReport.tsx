import { useEffect, useRef } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import type L from 'leaflet'

const LONG_PRESS_MS = 500
// Same tolerance as Leaflet's own tap-hold (Map.TapHold.js, `tapTolerance`):
// a finger always drifts a few pixels, so only a real move cancels the press.
const LONG_PRESS_TOLERANCE_PX = 15
// How long after a long-press is released a compatibility `click` is still
// treated as part of that gesture (browsers send it within a few ms, if at all).
const CLICK_SUPPRESS_MS = 400

function suppressClicksBriefly(untilRef: { current: number }) {
  untilRef.current = performance.now() + CLICK_SUPPRESS_MS
}

/**
 * Reports a candidate point for "signaler ici" (spec §6.1): click, or
 * long-press. Renders nothing itself — the caller (`MapPage`) turns the picked
 * point into a pin + confirm affordance, the same way `ClusteredKlashMarkers`
 * hands a klash to `KlashPreviewCard`.
 *
 * Leaflet has no long-press event, so it is timed here, differently per input,
 * with two independent timers:
 * - Mouse: Leaflet `mousedown` → `mouseup`; a map drag cancels it.
 * - Touch: native `touchstart` → `touchend` on the map container. Leaflet's
 *   `mousedown` can't be used: browsers only emit the compatibility mouse
 *   events (mousedown → mouseup → click) *after* `touchend`, so the timer
 *   would start once the finger is already up and never fire during the press.
 *   Leaflet's map `dragstart` must NOT cancel it: the map starts dragging after
 *   ~3px of movement, well inside the 15px a finger drifts during a hold, so
 *   only `LONG_PRESS_TOLERANCE_PX` of movement (or a second finger) cancels.
 *
 * After a successful long-press, the compatibility `click` that may follow its
 * release is ignored so the point isn't reported twice. That suppression
 * expires on its own (and a new touch clears it): browsers that send no click
 * after a long-press must not leave it armed to swallow the next real click.
 */
export function MapClickToReport({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const map = useMap()
  const mouseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mouseLongPressedRef = useRef(false)
  const suppressClickUntilRef = useRef(0)
  // Always the latest `onPick`, without re-binding the touch listeners below
  // each time `MapPage` passes a new inline callback. (`useEffectEvent` would
  // say it better, but the pinned eslint-plugin-react-hooks 5.2 doesn't know
  // it and would flag the effect.)
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onPickRef.current = onPick
  })

  function clearMouseTimer() {
    if (mouseTimerRef.current) {
      clearTimeout(mouseTimerRef.current)
      mouseTimerRef.current = null
    }
  }

  useMapEvents({
    click: (event) => {
      if (performance.now() < suppressClickUntilRef.current) return
      onPick(event.latlng.lat, event.latlng.lng)
    },
    mousedown: (event: L.LeafletMouseEvent) => {
      clearMouseTimer()
      mouseLongPressedRef.current = false
      mouseTimerRef.current = setTimeout(() => {
        mouseTimerRef.current = null
        mouseLongPressedRef.current = true
        onPick(event.latlng.lat, event.latlng.lng)
      }, LONG_PRESS_MS)
    },
    mouseup: () => {
      clearMouseTimer()
      if (mouseLongPressedRef.current) {
        mouseLongPressedRef.current = false
        suppressClicksBriefly(suppressClickUntilRef)
      }
    },
    dragstart: clearMouseTimer,
  })

  useEffect(() => {
    const container = map.getContainer()
    let timer: ReturnType<typeof setTimeout> | null = null
    let longPressed = false
    let startX = 0
    let startY = 0

    function cancel() {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    function onTouchStart(event: TouchEvent) {
      cancel()
      longPressed = false
      // A new gesture: the previous one's compatibility click is long gone.
      suppressClickUntilRef.current = 0
      // Pinch, or a touch on a marker / control: not a "pick here" gesture.
      if (event.touches.length !== 1) return
      if ((event.target as Element).closest('.leaflet-interactive, .leaflet-control')) return

      const touch = event.touches[0]
      startX = touch.clientX
      startY = touch.clientY
      // Resolved now, not when the timer fires: if the map drags along with a
      // drifting finger, the point under the finger is still this one.
      // `mouseEventToLatLng` only reads clientX/clientY, which a Touch has too
      // — hence the cast.
      const latlng = map.mouseEventToLatLng(touch as unknown as MouseEvent)
      timer = setTimeout(() => {
        timer = null
        longPressed = true
        onPickRef.current(latlng.lat, latlng.lng)
      }, LONG_PRESS_MS)
    }

    function onTouchMove(event: TouchEvent) {
      if (!timer) return
      const touch = event.touches[0]
      if (
        event.touches.length !== 1 ||
        Math.hypot(touch.clientX - startX, touch.clientY - startY) > LONG_PRESS_TOLERANCE_PX
      ) {
        cancel()
      }
    }

    function onTouchEnd() {
      cancel()
      if (longPressed) {
        longPressed = false
        suppressClicksBriefly(suppressClickUntilRef)
      }
    }

    function onTouchCancel() {
      cancel()
      longPressed = false
    }

    // Passive and never preventDefault'ed: Leaflet's drag/pinch handling and
    // the compatibility click after a tap must stay untouched.
    const options = { passive: true }
    container.addEventListener('touchstart', onTouchStart, options)
    container.addEventListener('touchmove', onTouchMove, options)
    container.addEventListener('touchend', onTouchEnd, options)
    container.addEventListener('touchcancel', onTouchCancel, options)
    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchCancel)
      cancel()
    }
  }, [map])

  return null
}
