import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { PIN_ICON } from './pinIcon'

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
