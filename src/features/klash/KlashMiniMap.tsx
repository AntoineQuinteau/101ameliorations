import { MapContainer, Marker } from 'react-leaflet'
import { MapTiles } from '../map/MapTiles'
import { getMarkerIcon } from '../map/markerIcons'
import type { Klash } from '../../types/klash'

/** Fixed, non-interactive mini map for the detail page: a single marker, no pan/zoom. */
export function KlashMiniMap({ klash }: { klash: Klash }) {
  const position: [number, number] = [klash.lat, klash.lng]

  return (
    <div className="h-48 w-full overflow-hidden rounded-lg">
      <MapContainer
        center={position}
        zoom={15}
        className="h-full w-full"
        zoomControl={false}
        dragging={false}
        touchZoom={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
      >
        <MapTiles />
        <Marker position={position} icon={getMarkerIcon(klash.urgency, klash.status)} />
      </MapContainer>
    </div>
  )
}
