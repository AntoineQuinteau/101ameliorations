import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

const PIN_ICON = L.divIcon({
  className: '',
  html: '<div class="h-8 w-8 -translate-x-1/2 -translate-y-full text-4xl leading-none drop-shadow-md">📍</div>',
  iconSize: [0, 0],
})

/** Static (non-draggable) marker shown at a candidate point picked via click
 * or long-press, before the user confirms "Signaler ici" (spec §6.1). */
export function PendingPinMarker({ position }: { position: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    const marker = L.marker(position, { icon: PIN_ICON, interactive: false }).addTo(map)
    return () => {
      map.removeLayer(marker)
    }
  }, [map, position])

  return null
}
