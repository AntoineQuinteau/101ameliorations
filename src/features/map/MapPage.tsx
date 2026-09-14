import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, ZoomControl } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import { AuthBadge } from './AuthBadge'
import { BboxWatcher } from './BboxWatcher'
import { ClusteredKlashMarkers } from './ClusteredKlashMarkers'
import { DesktopFiltersCard } from './DesktopFiltersCard'
import { filtersFromSearchParams, filtersToSearchParams } from './filterParams'
import { applyFilters, type KlashFilters } from './klashFilters'
import { KlashPreviewCard } from './KlashPreviewCard'
import { MapClickToReport } from './MapClickToReport'
import { MapTiles } from './MapTiles'
import { MobileFiltersSheet } from './MobileFiltersSheet'
import { PendingPinMarker } from './PendingPinMarker'
import { PinConfirmCard } from './PinConfirmCard'
import { useHasHover } from './useHasHover'
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
  const hasHover = useHasHover()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewportBbox, setViewportBbox] = useState<Bbox | null>(null)
  const [selectedKlash, setSelectedKlash] = useState<Klash | null>(null)
  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [filters, setFilters] = useState(() => filtersFromSearchParams(searchParams))
  const { data: klashes = [], isError, isFetching, refetch } = useKlashesInBbox(viewportBbox)

  const visibleKlashes = useMemo(
    () => applyFilters(klashes, filters, viewportBbox),
    [klashes, filters, viewportBbox],
  )

  // Applies live and writes the URL on every change, so a shared link
  // reopens the same view (spec §6.1). `replace: true` avoids stacking a
  // browser history entry per chip toggle — only the map's own navigations
  // (to /new, /k/:id) should be back-button stops.
  function updateFilters(nextFilters: KlashFilters) {
    setFilters(nextFilters)
    setSearchParams(filtersToSearchParams(nextFilters), { replace: true })
  }

  function handleMarkerSelect(klash: Klash) {
    // On a fine-pointer device, hover already previews the klash (see
    // onHover below) — a click there goes straight to the detail page,
    // skipping the extra "voir le détail" tap that only makes sense as a
    // second step on touch, where there's no hover to preview with first.
    if (hasHover) {
      navigate(`/k/${klash.id}`)
    } else {
      setSelectedKlash(klash)
    }
  }

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
        zoomControl={false}
        className="h-full w-full"
      >
        <MapTiles />
        {/* Moved off the default topleft: that's where the filters button
            (and, on desktop, the filters card) lives. */}
        <ZoomControl position="bottomright" />
        <BboxWatcher onChange={setViewportBbox} />
        <ClusteredKlashMarkers
          klashes={visibleKlashes}
          onSelect={handleMarkerSelect}
          onHover={hasHover ? setSelectedKlash : undefined}
        />
        <MapClickToReport onPick={(lat, lng) => setPendingPin({ lat, lng })} />
        {pendingPin && <PendingPinMarker position={[pendingPin.lat, pendingPin.lng]} />}
      </MapContainer>

      <AuthBadge />

      {/* On desktop the filters card is a small, semi-transparent overlay
          that never covers the map, so the other floating controls stay
          visible and usable regardless of isFiltersOpen. On mobile the
          filters sheet takes over the whole screen, so they hide while it's
          open (mirrored below). */}
      <button
        type="button"
        onClick={() => setIsFiltersOpen((open) => !open)}
        aria-pressed={isFiltersOpen}
        className="absolute top-3 left-3 z-[1000] rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow hover:bg-white"
      >
        {fr.map.filters.open}
      </button>

      {!pendingPin && !selectedKlash && (hasHover || !isFiltersOpen) && (
        <button
          type="button"
          onClick={handleReportHereButton}
          className="absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-teal-800"
        >
          {fr.map.reportWhereIAm}
        </button>
      )}

      {pendingPin && (hasHover || !isFiltersOpen) && (
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

      {hasHover ? (
        <DesktopFiltersCard
          isOpen={isFiltersOpen}
          filters={filters}
          resultsCount={visibleKlashes.length}
          onChange={updateFilters}
        />
      ) : (
        isFiltersOpen && (
          <MobileFiltersSheet
            filters={filters}
            resultsCount={visibleKlashes.length}
            onChange={updateFilters}
            onClose={() => setIsFiltersOpen(false)}
          />
        )
      )}

      {!isFiltersOpen && selectedKlash && (
        <KlashPreviewCard
          klash={selectedKlash}
          onClose={() => setSelectedKlash(null)}
          interactive={!hasHover}
        />
      )}
    </div>
  )
}
