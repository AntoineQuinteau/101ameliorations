import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer } from 'react-leaflet'
import type L from 'leaflet'
import { AuthBadge } from './AuthBadge'
import { BboxWatcher } from './BboxWatcher'
import { ClusteredKlashMarkers } from './ClusteredKlashMarkers'
import { DesktopFiltersCard } from './DesktopFiltersCard'
import { DraftInProgressChip } from './DraftInProgressChip'
import { filtersFromSearchParams, filtersToSearchParams } from './filterParams'
import { applyFilters, isDefaultFilters, type KlashFilters } from './klashFilters'
import { KlashPreviewCard } from './KlashPreviewCard'
import { MapClickToReport } from './MapClickToReport'
import { MapControlButton } from './MapControlButton'
import { MapLayerToggle } from './MapLayerToggle'
import { MapLayerZoom } from './MapLayerZoom'
import { MapTiles } from './MapTiles'
import { MapZoomLocateControls } from './MapZoomLocateControls'
import { MobileFiltersSheet } from './MobileFiltersSheet'
import { PendingPinMarker } from './PendingPinMarker'
import { PinConfirmCard } from './PinConfirmCard'
import { ServiceAreaBounds } from './ServiceAreaBounds'
import { UserPositionMarker } from './UserPositionMarker'
import { useHasHover } from './useHasHover'
import { useKlashesInBbox } from './useKlashesInBbox'
import { useMapLayer } from './useMapLayer'
import { AppFooterLinks } from '../../components/AppFooterLinks'
import { ErrorMessage } from '../../components/ErrorMessage'
import { FilterIcon } from '../../components/icons'
import {
  INITIAL_MAP_CENTER,
  INITIAL_MAP_ZOOM,
  MAX_SATELLITE_MAP_ZOOM,
  MIN_MAP_ZOOM,
} from '../../config/serviceArea'
import { useServiceArea } from '../../config/useServiceArea'
import { fr } from '../../i18n/fr'
import type { Klash } from '../../types/klash'
import type { Bbox } from '../../utils/bbox'
import { requestCurrentPosition, type GeolocationResult } from '../../utils/geolocation'
import { hasStoredDraft } from '../newKlash/draftStorage'

export function MapPage() {
  const navigate = useNavigate()
  const hasHover = useHasHover()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewportBbox, setViewportBbox] = useState<Bbox | null>(null)
  const [selectedKlash, setSelectedKlash] = useState<Klash | null>(null)
  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [filters, setFilters] = useState(() => filtersFromSearchParams(searchParams))
  const [layer, setLayer] = useMapLayer()
  const [map, setMap] = useState<L.Map | null>(null)
  const [userPosition, setUserPosition] = useState<GeolocationResult | null>(null)
  // Read in an effect, not a useState initializer: hasStoredDraft can purge
  // a stale draft as a side effect (see its docblock), which isn't safe
  // during render. This route remounts on every return from /new (a real
  // navigation, not client-side state), which is exactly when the draft
  // status can have changed (saved, resumed, submitted, or discarded).
  const [hasDraft, setHasDraft] = useState(false)
  useEffect(() => {
    setHasDraft(hasStoredDraft())
  }, [])
  const serviceArea = useServiceArea()
  const {
    data: klashes = [],
    isError,
    isFetching,
    refetch,
  } = useKlashesInBbox(viewportBbox, serviceArea)

  const visibleKlashes = useMemo(() => applyFilters(klashes, filters), [klashes, filters])

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
    requestCurrentPosition({ enableHighAccuracy: true, timeout: 5_000 }).then(
      (result) => goToNewKlash(result.lat, result.lng),
      () => {
        // No geolocation API, permission denied, or timed out — all fall
        // back the same way, to the centre of what's currently on screen.
        const center = viewportCenter()
        goToNewKlash(center.lat, center.lng)
      },
    )
  }

  // Computed once rather than repeated inline at every floating control
  // below: on desktop the filters card is a small overlay that never covers
  // the map, so the other controls stay visible regardless of
  // isFiltersOpen; on mobile the filters sheet takes over the whole screen,
  // so they hide while it's open.
  const showFloatingControls = hasHover || !isFiltersOpen
  const filtersActive = !isDefaultFilters(filters)

  return (
    <div className="relative h-dvh w-full">
      <MapContainer
        ref={setMap}
        center={INITIAL_MAP_CENTER}
        zoom={INITIAL_MAP_ZOOM}
        minZoom={MIN_MAP_ZOOM}
        // The higher of the two layers' ceilings, as a static prop — react-leaflet
        // only reads maxZoom once, at construction. MapLayerZoom narrows it at
        // runtime to whichever layer is actually active (see its docblock).
        maxZoom={MAX_SATELLITE_MAP_ZOOM}
        bounceAtZoomLimits={false}
        maxBoundsViscosity={1}
        zoomControl={false}
        className="h-full w-full"
      >
        <MapTiles layer={layer} />
        <MapLayerZoom layer={layer} />
        <ServiceAreaBounds bbox={serviceArea} />
        <BboxWatcher onChange={setViewportBbox} />
        <ClusteredKlashMarkers
          klashes={visibleKlashes}
          onSelect={handleMarkerSelect}
          onHover={hasHover ? setSelectedKlash : undefined}
        />
        <MapClickToReport onPick={(lat, lng) => setPendingPin({ lat, lng })} />
        {pendingPin && <PendingPinMarker position={[pendingPin.lat, pendingPin.lng]} />}
        {userPosition && <UserPositionMarker userPosition={userPosition} />}
      </MapContainer>

      <AuthBadge />

      {showFloatingControls && <AppFooterLinks />}

      {showFloatingControls && <MapLayerToggle layer={layer} onChange={setLayer} />}

      {/* Sits just below the layer switch, same left-edge column. The
          accessible label itself (not a separate sr-only span) carries
          whether filters are active: MapControlButton sets aria-label on
          the button, which overrides any name an inner span would
          otherwise contribute, so a visually-hidden span next to the dot
          would never reach screen readers. */}
      {showFloatingControls && (
        <MapControlButton
          label={filtersActive ? fr.map.filters.openActive : fr.map.filters.open}
          onClick={() => setIsFiltersOpen((open) => !open)}
          pressed={isFiltersOpen}
          className="absolute top-16 left-3 z-[1000]"
        >
          <FilterIcon className="h-5 w-5" />
          {filtersActive && (
            <span
              aria-hidden
              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-teal-600 ring-2 ring-white"
            />
          )}
        </MapControlButton>
      )}

      <MapZoomLocateControls
        map={map}
        serviceArea={serviceArea}
        onLocate={setUserPosition}
        visible={showFloatingControls}
      />

      {hasDraft && !pendingPin && !selectedKlash && showFloatingControls && <DraftInProgressChip />}

      {!pendingPin && !selectedKlash && showFloatingControls && (
        <button
          type="button"
          onClick={handleReportHereButton}
          className="absolute bottom-16 md:bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-teal-800"
        >
          {fr.map.reportWhereIAm}
        </button>
      )}

      {pendingPin && showFloatingControls && (
        <PinConfirmCard
          onConfirm={() => goToNewKlash(pendingPin.lat, pendingPin.lng)}
          onCancel={() => setPendingPin(null)}
        />
      )}

      {isFetching && !isError && (
        <div className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs text-neutral-600 shadow">
          {fr.common.loading}
        </div>
      )}

      {/* top-28 (112px), not top-0: the layer toggle (top-3, ends ~56px)
          and filters button (top-16, ends ~108px) now live in this same
          left-hand band (moved here from bottom-right in the maps.me
          redesign). A pointer-events-none wrapper with the card itself
          re-enabled only helped on viewports wide enough for max-w-md to
          leave empty space either side of the card — on a phone narrower
          than that the card spans the full width anyway and, at top-0,
          still covered and intercepted taps on both buttons regardless.
          Dropping below the whole control row avoids that at any width. */}
      {isError && (
        <div className="absolute inset-x-0 top-28 z-[1000] p-3">
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
