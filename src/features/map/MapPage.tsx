import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import { AuthBadge } from './AuthBadge'
import { BboxWatcher } from './BboxWatcher'
import { ClusteredKlashMarkers } from './ClusteredKlashMarkers'
import { KlashPreviewCard } from './KlashPreviewCard'
import { MapClickToReport } from './MapClickToReport'
import { MapTiles } from './MapTiles'
import { PendingPinMarker } from './PendingPinMarker'
import { PinConfirmCard } from './PinConfirmCard'
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
  const navigate = useNavigate()
  const [viewportBbox, setViewportBbox] = useState<Bbox | null>(null)
  const [selectedKlash, setSelectedKlash] = useState<Klash | null>(null)
  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null)
  const { data: klashes = [], isError, isFetching, refetch } = useKlashesInBbox(viewportBbox)

  function goToNewKlash(lat: number, lng: number) {
    navigate(`/new?lat=${lat}&lng=${lng}`)
  }

  function viewportCenter(): { lat: number; lng: number } {
    return viewportBbox
      ? {
          lat: (viewportBbox.minLat + viewportBbox.maxLat) / 2,
          lng: (viewportBbox.minLng + viewportBbox.maxLng) / 2,
        }
      : { lat: INITIAL_MAP_CENTER[0], lng: INITIAL_MAP_CENTER[1] }
  }

  function handleReportHereButton() {
    if (!navigator.geolocation) {
      const center = viewportCenter()
      goToNewKlash(center.lat, center.lng)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => goToNewKlash(position.coords.latitude, position.coords.longitude),
      () => {
        const center = viewportCenter()
        goToNewKlash(center.lat, center.lng)
      },
      { enableHighAccuracy: true, timeout: 5_000 },
    )
  }

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
        <MapClickToReport onPick={(lat, lng) => setPendingPin({ lat, lng })} />
        {pendingPin && <PendingPinMarker position={[pendingPin.lat, pendingPin.lng]} />}
      </MapContainer>

      <AuthBadge />

      {!pendingPin && !selectedKlash && (
        <button
          type="button"
          onClick={handleReportHereButton}
          className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-teal-800"
        >
          {fr.map.reportHere}
        </button>
      )}

      {pendingPin && (
        <PinConfirmCard
          onConfirm={() => goToNewKlash(pendingPin.lat, pendingPin.lng)}
          onCancel={() => setPendingPin(null)}
        />
      )}

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
