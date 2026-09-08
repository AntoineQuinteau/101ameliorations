import { useMemo, useState } from 'react'
import { MapContainer } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import { BboxWatcher } from './BboxWatcher'
import { ClusteredKlashMarkers } from './ClusteredKlashMarkers'
import { KlashPreviewCard } from './KlashPreviewCard'
import { MapTiles } from './MapTiles'
import { useKlashesInBbox } from './useKlashesInBbox'
import { ErrorMessage } from '../../components/ErrorMessage'
import {
  INITIAL_MAP_CENTER,
  INITIAL_MAP_ZOOM,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  SERVICE_AREA_BBOX,
} from '../../config/serviceArea'
import { fr } from '../../i18n/fr'
import type { Klash } from '../../types/klash'
import { expandBbox, type Bbox } from '../../utils/bbox'

export function MapPage() {
  const [viewportBbox, setViewportBbox] = useState<Bbox | null>(null)
  const [selectedKlash, setSelectedKlash] = useState<Klash | null>(null)
  const { data: klashes = [], isError, isFetching, refetch } = useKlashesInBbox(viewportBbox)

  // A little slack around the service area so the pan doesn't hard-stop right at its edge.
  const maxBounds = useMemo<LatLngBoundsExpression>(() => {
    const padded = expandBbox(SERVICE_AREA_BBOX, 0.1)
    return [
      [padded.minLat, padded.minLng],
      [padded.maxLat, padded.maxLng],
    ]
  }, [])

  return (
    <div className="relative h-dvh w-full">
      <MapContainer
        center={INITIAL_MAP_CENTER}
        zoom={INITIAL_MAP_ZOOM}
        minZoom={MIN_MAP_ZOOM}
        maxZoom={MAX_MAP_ZOOM}
        maxBounds={maxBounds}
        maxBoundsViscosity={1}
        className="h-full w-full"
      >
        <MapTiles />
        <BboxWatcher onChange={setViewportBbox} />
        <ClusteredKlashMarkers klashes={klashes} onSelect={setSelectedKlash} />
      </MapContainer>

      {isFetching && !isError && (
        <div className="absolute top-3 right-3 z-[1000] rounded-full bg-white/90 px-3 py-1 text-xs text-neutral-600 shadow">
          {fr.common.loading}
        </div>
      )}

      {isError && (
        <div className="absolute inset-x-0 top-0 z-[1000] p-3">
          <div className="mx-auto max-w-md rounded-xl bg-white shadow-lg ring-1 ring-black/5">
            <ErrorMessage message={fr.map.loadError} onRetry={() => refetch()} />
          </div>
        </div>
      )}

      {selectedKlash && (
        <KlashPreviewCard klash={selectedKlash} onClose={() => setSelectedKlash(null)} />
      )}
    </div>
  )
}
