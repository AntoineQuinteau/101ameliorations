import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import type L from 'leaflet'

const LONG_PRESS_MS = 500
// Same tolerance as Leaflet's own tap-hold (Map.TapHold.js, `tapTolerance`):
// a finger always drifts a few pixels, so only a real move cancels the press.
const LONG_PRESS_TOLERANCE_PX = 15

type Source = 'mouse' | 'touch'
type Press = { source: Source; timer: ReturnType<typeof setTimeout>; fired: boolean }

/**
 * Reports a candidate point for "signaler ici" (spec §6.1): click, or
 * long-press. Renders nothing itself — the caller (`MapPage`) turns the picked
 * point into a pin + confirm affordance, the same way `ClusteredKlashMarkers`
 * hands a klash to `KlashPreviewCard`.
 *
 * Leaflet has no long-press event, so it is timed here, from two input sources
 * that share one press state but differ in how they start and cancel it:
 * - Mouse: Leaflet `mousedown` → `mouseup`, left button only (right/middle open
 *   native menus that swallow `mouseup`; shift+drag is box zoom, which never
 *   emits `dragstart`). A map drag cancels it.
 * - Touch: native `touchstart` → `touchend` on the map container. Leaflet's
 *   `mousedown` can't be used: browsers only emit the compatibility mouse
 *   events (mousedown → mouseup → click) *after* `touchend`, so the timer
 *   would start once the finger is already up and never fire during the press.
 *   Leaflet's map `dragstart` must NOT cancel it: the map starts dragging after
 *   ~3px of movement, well inside the 15px a finger drifts during a hold, so
 *   only `LONG_PRESS_TOLERANCE_PX` of movement (or a second finger) cancels.
 *   While a touch press is in progress the native `contextmenu` is prevented:
 *   Android fires it at its own long-press timeout (400ms on Android 12+, before
 *   ours) and the browser menu would take over the gesture.
 *
 * After a long-press fires, the `click` that may follow its release is ignored
 * so the point isn't reported twice. That suppression is armed per source on
 * release, cleared by the next gesture of the same source (which always starts
 * before its own click), and only swallows a click of that same source: some
 * browsers send no click at all after a long-press, and a stale flag must not
 * eat the next real click, nor one from another input device.
 *
 * Everything lives in one `[map]` effect, so the listeners are bound once and
 * the pending timer is cleared on unmount.
 */
export function MapClickToReport({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const map = useMap()
  // Always the latest `onPick`, without re-binding the listeners below each
  // time `MapPage` passes a new inline callback. (`useEffectEvent` would say it
  // better, but the pinned eslint-plugin-react-hooks 5.2 doesn't know it and
  // would flag the effect.)
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onPickRef.current = onPick
  })

  useEffect(() => {
    const container = map.getContainer()
    let press: Press | null = null
    let suppressClick: Source | null = null
    let touchStartX = 0
    let touchStartY = 0

    function clearPress() {
      if (press) {
        clearTimeout(press.timer)
        press = null
      }
    }

    function startPress(source: Source, latlng: L.LatLng) {
      clearPress()
      const current: Press = {
        source,
        fired: false,
        timer: setTimeout(() => {
          current.fired = true
          onPickRef.current(latlng.lat, latlng.lng)
        }, LONG_PRESS_MS),
      }
      press = current
    }

    // Abandons a press of `source` that hasn't fired yet.
    function cancelPress(source: Source) {
      if (press?.source === source && !press.fired) clearPress()
    }

    // The finger / button went up: a press that fired makes the click that may
    // follow a no-op.
    function releasePress(source: Source) {
      if (press?.source !== source) return
      if (press.fired) suppressClick = source
      clearPress()
    }

    function onClick(event: L.LeafletMouseEvent) {
      const suppressed = suppressClick
      suppressClick = null
      if (suppressed) {
        // `pointerType` says what produced this click; it is absent on older
        // browsers, where any armed suppression applies.
        const type = (event.originalEvent as PointerEvent).pointerType
        if (!type || (type === 'mouse') === (suppressed === 'mouse')) return
      }
      onPickRef.current(event.latlng.lat, event.latlng.lng)
    }

    function onMouseDown(event: L.LeafletMouseEvent) {
      const { button, shiftKey, ctrlKey } = event.originalEvent
      // ctrl+click is a right click on macOS.
      if (button !== 0 || shiftKey || ctrlKey) return
      if (suppressClick === 'mouse') suppressClick = null
      startPress('mouse', event.latlng)
    }

    function onTouchStart(event: TouchEvent) {
      if (suppressClick === 'touch') suppressClick = null
      clearPress()
      // Pinch, or a touch on a marker / control: not a "pick here" gesture.
      if (event.touches.length !== 1) return
      if ((event.target as Element).closest('.leaflet-interactive, .leaflet-control')) return

      const touch = event.touches[0]
      touchStartX = touch.clientX
      touchStartY = touch.clientY
      // Resolved now, not when the timer fires: if the map drags along with a
      // drifting finger, the point under the finger is still this one.
      // `mouseEventToLatLng` only reads clientX/clientY, which a Touch has too
      // — hence the cast.
      startPress('touch', map.mouseEventToLatLng(touch as unknown as MouseEvent))
    }

    function onTouchMove(event: TouchEvent) {
      const touch = event.touches[0]
      if (
        event.touches.length !== 1 ||
        Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY) >
          LONG_PRESS_TOLERANCE_PX
      ) {
        cancelPress('touch')
      }
    }

    function onTouchEnd() {
      releasePress('touch')
    }

    function onTouchCancel() {
      if (press?.source === 'touch') clearPress()
    }

    function onContextMenu(event: Event) {
      if (press?.source === 'touch') event.preventDefault()
    }

    const mapHandlers: L.LeafletEventHandlerFnMap = {
      click: onClick,
      mousedown: onMouseDown,
      mouseup: () => releasePress('mouse'),
      dragstart: () => cancelPress('mouse'),
    }
    map.on(mapHandlers)

    // Passive and never preventDefault'ed: Leaflet's drag/pinch handling and
    // the compatibility click after a tap must stay untouched.
    const options = { passive: true }
    container.addEventListener('touchstart', onTouchStart, options)
    container.addEventListener('touchmove', onTouchMove, options)
    container.addEventListener('touchend', onTouchEnd, options)
    container.addEventListener('touchcancel', onTouchCancel, options)
    container.addEventListener('contextmenu', onContextMenu)
    return () => {
      map.off(mapHandlers)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchCancel)
      container.removeEventListener('contextmenu', onContextMenu)
      clearPress()
    }
  }, [map])

  return null
}
