import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

const PIN_ICON = L.divIcon({
  className: '',
  html: '<div class="h-8 w-8 -translate-x-1/2 -translate-y-full text-4xl leading-none drop-shadow-md">📍</div>',
  iconSize: [0, 0],
})

/** A single draggable marker used to pick the klash's position (spec §6.2
 * step 1). Kept as an imperative Leaflet marker (same rationale as
 * `ClusteredKlashMarkers`: no react-leaflet wrapper needed for something this
 * simple) rather than react-leaflet's `<Marker draggable>`, so dragend can
 * report plain lat/lng without re-deriving them from a Leaflet event shape
 * in the parent. */
export function DraggablePin({
  position,
  onMove,
}: {
  position: [number, number]
  onMove: (lat: number, lng: number) => void
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
    // drag momentum / re-adding on every parent re-render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  useEffect(() => {
    markerRef.current?.setLatLng(position)
  }, [position])

  return null
}
