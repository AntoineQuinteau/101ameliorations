import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

/** Recentres the map imperatively when `position` is set. `<MapContainer
 * center>` only applies at construction time (react-leaflet 4.x — same
 * caveat `MapLayerZoom`'s docblock already notes for `maxZoom`), so a
 * position set *after* mount needs an explicit `map.setView` or the view
 * never follows it.
 *
 * Deliberately driven by a separate prop, not the pin's own `position`
 * state directly: that also updates on every ordinary drag
 * (`DraggablePin`), and recentring on every drag would yank the view out
 * from under the user mid-gesture. `NewKlashPage` only sets this for the
 * one programmatic jump that actually needs it — resuming a draft saved
 * far from the incoming `?lat=&lng=`. */
export function MapRecenter({ position }: { position: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (position) map.setView(position, map.getZoom())
  }, [map, position])

  return null
}
