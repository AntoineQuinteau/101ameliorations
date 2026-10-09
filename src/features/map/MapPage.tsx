import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer } from 'react-leaflet'
import type L from 'leaflet'
import { AboutSheet } from './AboutSheet'
import { AdminShortcut } from './AdminShortcut'
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
import { useHasHover } from '../../hooks/useHasHover'
import { useKlashesInBbox } from './useKlashesInBbox'
import { useMapLayer } from './useMapLayer'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Funnel, Info } from 'lucide-react'
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
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const aboutButtonRef = useRef<HTMLButtonElement>(null)
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

  // Every way of closing the about sheet goes through here. It also clears the
  // preview: on a fine-pointer device hovering a marker sets `selectedKlash`
  // even while the sheet hides it, which would otherwise pop a card the user
  // didn't ask for once the sheet is gone.
  const closeAbout = useCallback(() => {
    setIsAboutOpen(false)
    setSelectedKlash(null)
  }, [])

  // The about sheet and the filters panel are mutually exclusive: opening
  // either closes the other (`toggleAbout` also clears the pending pin, which
  // the about sheet would otherwise sit on top of). Opening filters leaves the
  // pin alone, as it always has: on desktop the filters card is a small
  // overlay that doesn't compete with it.
  function toggleFilters() {
    if (isAboutOpen) closeAbout()
    setIsFiltersOpen((open) => !open)
  }

  function toggleAbout() {
    if (isAboutOpen) {
      closeAbout()
      return
    }
    setIsFiltersOpen(false)
    setSelectedKlash(null)
    setPendingPin(null)
    setIsAboutOpen(true)
  }

  function handleMarkerSelect(klash: Klash) {
    if (isAboutOpen) closeAbout()
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

  // `accuracyM` only when the point is a GPS fix: /new shows it on the
  // position step (spec §6.2 step 1), and has no other way to know how a
  // point it's handed was obtained — a long-pressed point has no accuracy.
  function goToNewKlash(lat: number, lng: number, accuracyM?: number) {
    const accuracyParam = accuracyM === undefined ? '' : `&acc=${Math.round(accuracyM)}`
    navigate(`/new?lat=${lat}&lng=${lng}${accuracyParam}`)
  }

  function viewportCenter(): { lat: number; lng: number } {
    return viewportBbox
      ? {
          lat: (viewportBbox.minLat + viewportBbox.maxLat) / 2,
          lng: (viewportBbox.minLng + viewportBbox.maxLng) / 2,
        }
      : { lat: INITIAL_MAP_CENTER[0], lng: INITIAL_MAP_CENTER[1] }
  }

  // "Signaler ici" waits up to 5s for a fix, long enough for the user to
  // have left the map meanwhile (a klash's detail page, the profile button):
  // navigating to /new once it lands would pull them off wherever they went.
  const isMountedRef = useRef(false)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  function handleReportHereButton() {
    requestCurrentPosition({ enableHighAccuracy: true, timeout: 5_000 }).then(
      (result) => {
        if (!isMountedRef.current) return
        goToNewKlash(result.lat, result.lng, result.accuracyM)
      },
      () => {
        if (!isMountedRef.current) return
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
        <MapClickToReport
          onPick={(lat, lng) => {
            // Like clicking outside a popover: with the About sheet open, the
            // click only dismisses it, instead of also dropping a pin the user
            // didn't ask for.
            if (isAboutOpen) {
              closeAbout()
              return
            }
            setPendingPin({ lat, lng })
          }}
        />
        {pendingPin && <PendingPinMarker position={[pendingPin.lat, pendingPin.lng]} />}
        {userPosition && <UserPositionMarker userPosition={userPosition} />}
      </MapContainer>

      <AuthBadge />

      {showFloatingControls && <AdminShortcut />}

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
          onClick={toggleFilters}
          pressed={isFiltersOpen}
          className="absolute top-16 left-3 z-[1000]"
        >
          <Funnel className="size-5" />
          {filtersActive && (
            <span
              aria-hidden
              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-teal-600 ring-2 ring-white"
            />
          )}
        </MapControlButton>
      )}

      {/* Third in the left-hand column, under the filters button. */}
      {showFloatingControls && (
        <MapControlButton
          ref={aboutButtonRef}
          label={fr.about.title}
          onClick={toggleAbout}
          pressed={isAboutOpen}
          className="absolute top-29 left-3 z-[1000]"
        >
          <Info className="size-5" />
        </MapControlButton>
      )}

      <MapZoomLocateControls
        map={map}
        serviceArea={serviceArea}
        onLocate={setUserPosition}
        visible={showFloatingControls}
      />

      {hasDraft && !pendingPin && !selectedKlash && !isAboutOpen && showFloatingControls && (
        <DraftInProgressChip />
      )}

      {!pendingPin && !selectedKlash && !isAboutOpen && showFloatingControls && (
        <button
          type="button"
          onClick={handleReportHereButton}
          className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-teal-800"
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

      {/* Kept clear of every floating control, at any viewport size:
          top-44 (176px) puts it below the left-hand layer/filters/about
          column (ends ~160px), and px-16 (64px) keeps the card out of the right
          edge's zoom/locate column (right-3 + 44px = 56px), which is
          vertically centred and so reaches this band on short screens. The
          wrapper itself spans the full width, so it's pointer-events-none
          with only the card re-enabled — otherwise its empty sides would
          still swallow taps and map drags across the whole band. */}
      {isError && (
        <div className="pointer-events-none absolute inset-x-0 top-44 z-[1000] px-16 py-3">
          <div className="pointer-events-auto mx-auto max-w-md rounded-xl bg-white shadow-lg ring-1 ring-black/5">
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

      {isAboutOpen && <AboutSheet onClose={closeAbout} returnFocusRef={aboutButtonRef} />}

      {!isFiltersOpen && !isAboutOpen && selectedKlash && (
        <KlashPreviewCard
          klash={selectedKlash}
          onClose={() => setSelectedKlash(null)}
          interactive={!hasHover}
        />
      )}
    </div>
  )
}
