import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
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
import { applyFilters, defaultFilters, isDefaultFilters, type KlashFilters } from './klashFilters'
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
import { isPointInBbox, type Bbox } from '../../utils/bbox'
import { requestCurrentPosition, type GeolocationResult } from '../../utils/geolocation'
import { hasStoredDraft } from '../newKlash/draftStorage'
import type { AppOutletContext } from '../../App'
import { useAuth } from '../auth/useAuth'
import { KLASH_OVERLAY_STATE } from '../klash/klashOverlay'
import { klashPhotosQuery } from '../klash/klashPhotosQuery'
import { WelcomeDialog } from '../welcome/WelcomeDialog'
import { readWelcomeSeen, shouldAutoShowWelcome, writeWelcomeSeen } from '../welcome/welcomeStorage'

export function MapPage({ isKlashOverlayOpen }: { isKlashOverlayOpen: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const hasHover = useHasHover()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewportBbox, setViewportBbox] = useState<Bbox | null>(null)
  const [selectedKlash, setSelectedKlash] = useState<Klash | null>(null)
  const [pendingPin, setPendingPin] = useState<{ lat: number; lng: number } | null>(null)
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const aboutButtonRef = useRef<HTMLButtonElement>(null)
  const filtersButtonRef = useRef<HTMLButtonElement>(null)
  const refocusFiltersButton = useRef(false)
  const { user, isInitializing } = useAuth()
  const { setInstallPromptSuppressed } = useOutletContext<AppOutletContext>()
  const [welcomeSeen, setWelcomeSeen] = useState(readWelcomeSeen)
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false)
  // Only a reopen from the About sheet has a control to give focus back to.
  const [isWelcomeFromAbout, setIsWelcomeFromAbout] = useState(false)
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
  // First-visit welcome dialog (spec §6.1): opens by itself for a signed-out
  // visitor who hasn't seen it. A signed-in user never needs it, so it counts
  // as seen for them (it would otherwise pop up after a later sign-out).
  useEffect(() => {
    if (isKlashOverlayOpen) return
    if (shouldAutoShowWelcome({ seen: welcomeSeen, isInitializing, isSignedIn: user !== null })) {
      setIsWelcomeOpen(true)
    } else if (!welcomeSeen && !isInitializing && user) {
      writeWelcomeSeen()
      setWelcomeSeen(true)
    }
  }, [welcomeSeen, isInitializing, user, isKlashOverlayOpen])

  // The install banner waits while the dialog is open or still due (including
  // while auth initializes), so the two never stack or flash in sequence.
  const isWelcomePending = !welcomeSeen && !user
  const holdInstallPrompt = isWelcomeOpen || isWelcomePending
  useEffect(() => {
    setInstallPromptSuppressed(holdInstallPrompt)
    return () => setInstallPromptSuppressed(false)
  }, [holdInstallPrompt, setInstallPromptSuppressed])

  // Every way of closing the dialog counts as having seen it.
  function closeWelcome() {
    writeWelcomeSeen()
    setWelcomeSeen(true)
    setIsWelcomeOpen(false)
    setIsWelcomeFromAbout(false)
  }

  function showWelcomeFromAbout() {
    closeAbout()
    setPendingPin(null)
    setIsWelcomeFromAbout(true)
    setIsWelcomeOpen(true)
  }

  const serviceArea = useServiceArea()
  const {
    data: klashes = [],
    isError,
    isFetching,
    refetch,
  } = useKlashesInBbox(viewportBbox, serviceArea)

  const visibleKlashes = useMemo(() => applyFilters(klashes, filters), [klashes, filters])

  // `klashes` covers a padded viewport (see useKlashesInBbox), so what the
  // user is told about — the results count, and whether the filters are
  // hiding everything — is narrowed to what is actually on screen.
  const klashesInView = useMemo(
    () =>
      viewportBbox
        ? klashes.filter((klash) => isPointInBbox(klash.lat, klash.lng, viewportBbox))
        : [],
    [klashes, viewportBbox],
  )
  const resultsCount = useMemo(
    () => applyFilters(klashesInView, filters).length,
    [klashesInView, filters],
  )

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
  function closeAbout() {
    setIsAboutOpen(false)
    setSelectedKlash(null)
  }

  // The about sheet and the filters panel are mutually exclusive: opening
  // either closes the other (`toggleAbout` also clears the pending pin, which
  // the about sheet would otherwise sit on top of). Opening filters leaves the
  // pin alone, as it always has: on desktop the filters card is a small
  // overlay that doesn't compete with it.
  function toggleFilters() {
    if (isAboutOpen) closeAbout()
    setIsFiltersOpen((open) => !open)
  }

  // Closing the filters panel from inside it (close button, Escape, the
  // mobile sheet's main button) puts focus back on the filters button. On
  // mobile that button is unmounted while the sheet is open (see
  // `showFloatingControls`), so focus can only go back to it once it has
  // rendered again — hence an effect rather than a call right after closing,
  // as `AboutSheet` does with its always-mounted button.
  function closeFilters() {
    refocusFiltersButton.current = true
    setIsFiltersOpen(false)
  }
  useEffect(() => {
    if (isFiltersOpen || !refocusFiltersButton.current) return
    refocusFiltersButton.current = false
    filtersButtonRef.current?.focus()
  }, [isFiltersOpen])

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

  // Desktop hover preview. Also warms the klash's photos: a click usually
  // follows, and the detail modal then opens with its gallery already in
  // place instead of having it push the rest of the content down a moment
  // later. One small read per hovered klash, cached like any other query.
  function handleMarkerHover(klash: Klash | null) {
    setSelectedKlash(klash)
    if (klash) void queryClient.prefetchQuery(klashPhotosQuery(klash.id))
  }

  function handleMarkerSelect(klash: Klash) {
    if (isAboutOpen) closeAbout()
    // On a fine-pointer device, hover already previews the klash (see
    // onHover below) — a click there goes straight to the detail, opened in
    // a modal over this still-mounted map (spec §6.3), skipping the extra
    // "voir le détail" tap that only makes sense as a second step on touch,
    // where there's no hover to preview with first.
    if (hasHover) {
      setSelectedKlash(null)
      navigate(`/k/${klash.id}`, { state: KLASH_OVERLAY_STATE })
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
  const isKlashOverlayOpenRef = useRef(isKlashOverlayOpen)
  useEffect(() => {
    isKlashOverlayOpenRef.current = isKlashOverlayOpen
  }, [isKlashOverlayOpen])
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  function handleReportHereButton() {
    requestCurrentPosition({ enableHighAccuracy: true, timeout: 5_000 }).then(
      (result) => {
        if (!isMountedRef.current || isKlashOverlayOpenRef.current) return
        goToNewKlash(result.lat, result.lng, result.accuracyM)
      },
      () => {
        if (!isMountedRef.current || isKlashOverlayOpenRef.current) return
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
  // The desktop filters card is open: the bottom sheets shift out from under
  // it where the window is narrow enough for them to meet (see BottomSheet).
  const isDesktopFiltersCardOpen = hasHover && isFiltersOpen
  const filtersActive = !isDefaultFilters(filters)
  // Only when resetting would bring something back: an area with no klash
  // at all is empty whatever the filters.
  const filtersHideEverything = filtersActive && klashesInView.length > 0 && resultsCount === 0

  return (
    <div className="relative h-dvh w-full" inert={isKlashOverlayOpen}>
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
          onHover={hasHover ? handleMarkerHover : undefined}
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
          ref={filtersButtonRef}
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
          className="absolute bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-teal-800"
        >
          {fr.map.reportWhereIAm}
        </button>
      )}

      {pendingPin && showFloatingControls && (
        <PinConfirmCard
          onConfirm={() => goToNewKlash(pendingPin.lat, pendingPin.lng)}
          onCancel={() => setPendingPin(null)}
          clearOfFiltersCard={isDesktopFiltersCardOpen}
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

      {/* Without this, a map emptied by its filters only says so through the
          dot on the filters button. Same band and side margins as the error
          card above, and never shown with it. Hidden while a filters panel
          is open: that panel has its own count and reset button. */}
      {filtersHideEverything && !isError && !isFiltersOpen && !isAboutOpen && (
        <div className="pointer-events-none absolute inset-x-0 top-44 z-[1000] px-16 py-3">
          <div
            role="status"
            className="pointer-events-auto mx-auto flex w-fit max-w-md flex-wrap items-center justify-center gap-x-2 rounded-xl bg-white px-4 py-1 text-sm text-neutral-700 shadow-lg ring-1 ring-black/5"
          >
            <span className="py-1">{fr.map.filters.emptyWithFilters}</span>
            <button
              type="button"
              onClick={() => updateFilters(defaultFilters)}
              className="inline-flex min-h-11 items-center rounded-md px-1 font-medium text-teal-700 hover:text-teal-800 hover:underline"
            >
              {fr.map.filters.reset}
            </button>
          </div>
        </div>
      )}

      {hasHover ? (
        <DesktopFiltersCard
          isOpen={isFiltersOpen}
          filters={filters}
          resultsCount={resultsCount}
          onChange={updateFilters}
          onClose={closeFilters}
        />
      ) : (
        isFiltersOpen && (
          <MobileFiltersSheet
            filters={filters}
            resultsCount={resultsCount}
            onChange={updateFilters}
            onClose={closeFilters}
          />
        )
      )}

      {isAboutOpen && (
        <AboutSheet
          onClose={closeAbout}
          onShowWelcome={showWelcomeFromAbout}
          returnFocusRef={aboutButtonRef}
        />
      )}

      {isWelcomeOpen && (
        <WelcomeDialog
          onClose={closeWelcome}
          returnFocusRef={isWelcomeFromAbout ? aboutButtonRef : undefined}
        />
      )}

      {/* `showFloatingControls`, not `!isFiltersOpen`: only the mobile filters
          sheet covers the screen. The desktop card is a corner overlay, and
          hovering the markers a filter left is what it is kept open for. */}
      {showFloatingControls && !isAboutOpen && !isKlashOverlayOpen && selectedKlash && (
        <KlashPreviewCard
          klash={selectedKlash}
          onClose={() => setSelectedKlash(null)}
          interactive={!hasHover}
          clearOfFiltersCard={isDesktopFiltersCardOpen}
        />
      )}
    </div>
  )
}
