import { Circle, CircleMarker } from 'react-leaflet'
import type { PathOptions } from 'leaflet'

// Hoisted rather than written inline on the elements below: react-leaflet
// v4 calls setStyle whenever a `pathOptions` prop is a *new* object, even
// with identical values — an inline object literal is new on every render
// of the parent (MapPage/NewKlashPage), so every keystroke on NewKlashPage's
// form step (formDraft lives there) was triggering a redraw of both circles
// for no visual change. Module-level constants are the same object across
// every render, so React's prop comparison (and therefore setStyle) only
// fires when the value actually needs to change.
const ACCURACY_PATH_OPTIONS: PathOptions = {
  color: '#0ea5e9',
  weight: 1,
  fillColor: '#0ea5e9',
  fillOpacity: 0.12,
}
const DOT_PATH_OPTIONS: PathOptions = {
  color: '#ffffff',
  weight: 2,
  fillColor: '#0ea5e9',
  fillOpacity: 1,
}

/** "You are here" dot for the map, drawn once `MapZoomLocateControls`' locate
 * button has found a position — same visual convention as Google/Apple Maps
 * (a solid blue dot with a faint accuracy halo). `interactive={false}` on
 * both: it's a status indicator, not something to click or that should steal
 * a tap from `MapClickToReport`.
 *
 * `position` itself is still a fresh `[lat, lng]` tuple from the caller on
 * every render — memoize it there (e.g. with `useMemo` keyed on the
 * underlying `userPosition` state) if the same churn shows up for it; this
 * component only owns the `pathOptions` half of the problem. */
export function UserPositionMarker({
  position,
  accuracyM,
}: {
  position: [number, number]
  accuracyM: number | null
}) {
  return (
    <>
      {accuracyM !== null && accuracyM > 0 && (
        <Circle
          center={position}
          radius={accuracyM}
          interactive={false}
          pathOptions={ACCURACY_PATH_OPTIONS}
        />
      )}
      <CircleMarker
        center={position}
        radius={7}
        interactive={false}
        pathOptions={DOT_PATH_OPTIONS}
      />
    </>
  )
}
