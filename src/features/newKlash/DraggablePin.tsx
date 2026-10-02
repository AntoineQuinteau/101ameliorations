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
 * `draggable` defaults to `true` (the position step) but `NewKlashPage`
 * passes `false` from the form step onward: the pin's spot has by then gone
 * through duplicate detection (klashes_nearby, spec §6.2 step 2), and an
 * accidental or deliberate drag there would silently move the klash's
 * eventual location past that check, same hazard the zoom/locate column is
 * hidden for over the same range of steps. */
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
    const marker = L.marker(position, { icon: PIN_ICON, draggable: true }).addTo(map)
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
    // applied by its own effect below for the same reason.
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
