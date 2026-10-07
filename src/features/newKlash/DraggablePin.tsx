import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { PIN_ICON } from '../map/pinIcon'

/** A single draggable marker used to pick the klash's position (spec §6.2
 * step 1). Kept as an imperative Leaflet marker (same rationale as
 * `ClusteredKlashMarkers`: no react-leaflet wrapper needed for something this
 * simple) rather than react-leaflet's `<Marker draggable>`, so dragend can
 * report plain lat/lng without re-deriving them from a Leaflet event shape
 * in the parent.
 *
 * `draggable` defaults to `true`, but `NewKlashPage` only enables it on the
 * position and duplicates steps: from the form step onward the pin's spot
 * has gone through duplicate detection (klashes_nearby, spec §6.2 step 2),
 * and a drag there would silently move the klash's eventual location past
 * that check, same hazard the zoom/locate column is hidden for over the
 * same range of steps. On the draft-resume screen, "Reprendre ma
 * déclaration" replaces the position with the draft's, so a drag there
 * would just be thrown away. */
export function DraggablePin({
  position,
  onMove,
  draggable = true,
}: {
  position: [number, number]
  onMove: (lat: number, lng: number) => void
  draggable?: boolean
}) {
  const map = useMap()
  const markerRef = useRef<L.Marker | null>(null)
  const onMoveRef = useRef(onMove)

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    const marker = L.marker(position, { icon: PIN_ICON, draggable }).addTo(map)
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng()
      onMoveRef.current(lat, lng)
    })
    markerRef.current = marker

    return () => {
      map.removeLayer(marker)
      markerRef.current = null
    }
    // Only recreated if the map instance changes — position updates below
    // move the existing marker instead of tearing it down (avoids losing
    // drag momentum / re-adding on every parent re-render). `draggable` is
    // applied by its own effect below for the same reason, and read here
    // only so a marker recreated for a new map starts in the right state —
    // that effect doesn't re-run unless `draggable` itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  useEffect(() => {
    markerRef.current?.setLatLng(position)
  }, [position])

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    if (draggable) marker.dragging?.enable()
    else marker.dragging?.disable()
  }, [draggable])

  return null
}
