import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import type L from 'leaflet'

const LONG_PRESS_MS = 500
// Same tolerance as Leaflet's own tap-hold (Map.TapHold.js, `tapTolerance`):
// a finger always drifts a few pixels, so only a real move cancels the press.
const LONG_PRESS_TOLERANCE_PX = 15

type Source = 'mouse' | 'touch'
type Press = {
  source: Source
  latlng: L.LatLng
  // Where the press started, in client pixels. Only the touch path measures
  // drift against it; the mouse path relies on Leaflet's `dragstart`.
  startX: number
  startY: number
  timer: ReturnType<typeof setTimeout>
  fired: boolean
}

// A press on a marker / cluster or a control is aimed at it, not at the map.
function isOnMarkerOrControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element && target.closest('.leaflet-interactive, .leaflet-control') !== null
  )
}

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
 *   emits `dragstart`). A map drag cancels it. Markers only listen for click
 *   and hover, so Leaflet hands a press on one to the map: it is skipped here,
 *   as on the touch path.
 * - Touch: native `touchstart` → `touchend` on the map container. Leaflet's
 *   `mousedown` can't be used: browsers only emit the compatibility mouse
 *   events (mousedown → mouseup → click) *after* `touchend`, so the timer
 *   would start once the finger is already up and never fire during the press.
 *   Leaflet's map `dragstart` must NOT cancel it: the map starts dragging after
 *   ~3px of movement, well inside the 15px a finger drifts during a hold, so
 *   only `LONG_PRESS_TOLERANCE_PX` of movement (or a second finger) cancels.
 *   While a touch press is in progress the native `contextmenu` is prevented,
 *   and taken as the long-press itself: Android fires it at its own long-press
 *   timeout (400ms on Android 12+, before ours), the browser menu would take
 *   over the gesture, and once it has fired no click follows the release — a
 *   hold between that timeout and ours would otherwise pick nothing.
 *
 * After a long-press fires, the `click` that may follow its release is ignored
 * so the point isn't reported twice. That suppression is armed per source on
 * release, cleared by the next gesture of the same source (which always starts
 * before its own click), and only lets through a click that clearly comes from
 * the other source: some browsers send no click at all after a long-press, and
 * a stale flag must not eat the next real click from another input device. A
 * pen's click (`pointerType` 'pen') counts as either source, since pen input
 * takes the mouse path on some platforms (Windows) and the touch one on others
 * (iPadOS).
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

    function clearPress() {
      if (press) {
        clearTimeout(press.timer)
        press = null
      }
    }

    function startPress(source: Source, latlng: L.LatLng, startX: number, startY: number) {
      clearPress()
      const current: Press = {
        source,
        latlng,
        startX,
        startY,
        fired: false,
        timer: setTimeout(() => firePress(current), LONG_PRESS_MS),
      }
      press = current
    }

    function firePress(current: Press) {
      if (current.fired) return
      clearTimeout(current.timer)
      current.fired = true
      onPickRef.current(current.latlng.lat, current.latlng.lng)
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
        const otherSource: Source = suppressed === 'mouse' ? 'touch' : 'mouse'
        if (type !== otherSource) return
      }
      onPickRef.current(event.latlng.lat, event.latlng.lng)
    }

    function onMouseDown(event: L.LeafletMouseEvent) {
      const { button, shiftKey, ctrlKey, target, clientX, clientY } = event.originalEvent
      // ctrl+click is a right click on macOS.
      if (button !== 0 || shiftKey || ctrlKey) return
      if (suppressClick === 'mouse') suppressClick = null
      if (isOnMarkerOrControl(target)) return
      startPress('mouse', event.latlng, clientX, clientY)
    }

    function onTouchStart(event: TouchEvent) {
      if (suppressClick === 'touch') suppressClick = null
      clearPress()
      // Pinch, or a touch on a marker / control: not a "pick here" gesture.
      if (event.touches.length !== 1 || isOnMarkerOrControl(event.target)) return

      const touch = event.touches[0]
      // Resolved now, not when the timer fires: if the map drags along with a
      // drifting finger, the point under the finger is still this one.
      // `mouseEventToLatLng` only reads clientX/clientY, which a Touch has too
      // — hence the cast.
      startPress(
        'touch',
        map.mouseEventToLatLng(touch as unknown as MouseEvent),
        touch.clientX,
        touch.clientY,
      )
    }

    function onTouchMove(event: TouchEvent) {
      // Runs on every frame of a pan or pinch: bail out unless a touch press
      // is still pending.
      if (press?.source !== 'touch' || press.fired) return
      const touch = event.touches[0]
      if (
        event.touches.length !== 1 ||
        Math.hypot(touch.clientX - press.startX, touch.clientY - press.startY) >
          LONG_PRESS_TOLERANCE_PX
      ) {
        clearPress()
      }
    }

    function onTouchEnd() {
      releasePress('touch')
    }

    function onTouchCancel() {
      if (press?.source === 'touch') clearPress()
    }

    function onContextMenu(event: Event) {
      if (press?.source !== 'touch') return
      event.preventDefault()
      // The platform has recognised a long-press: pick now rather than wait
      // for our timer, since no click will follow the release.
      firePress(press)
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
