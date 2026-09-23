import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer } from 'react-leaflet'
import { CancelDraftSheet } from './CancelDraftSheet'
import { DraggablePin } from './DraggablePin'
import { clearDraftPhotos, loadDraftPhotos } from './draftPhotoStore'
import {
  clearStoredDraft,
  isDraftWorthKeeping,
  readStoredDraft,
  type StoredKlashDraft,
} from './draftStorage'
import { DraftResumeStep } from './DraftResumeStep'
import { DuplicatesStep } from './DuplicatesStep'
import { KlashFormStep, type PendingPhoto } from './KlashFormStep'
import { MapRecenter } from './MapRecenter'
import { PositionStep } from './PositionStep'
import { SubmitStep } from './SubmitStep'
import { useDraftAutosave } from './useDraftAutosave'
import { useGeolocation } from './useGeolocation'
import { emptyKlashFormDraft, type KlashFormDraft, type NewKlashForm } from './newKlashSchemas'
import { createSubmitGuard } from './submitGuard'
import { confirmKlash } from '../../api/confirmations'
import { createKlash } from '../../api/klashes'
import { uploadKlashPhoto } from '../../api/klashPhotos'
import { klashKeys } from '../../api/queryKeys'
import { BottomSheet } from '../../components/BottomSheet'
import { BboxWatcher } from '../map/BboxWatcher'
import { ClusteredKlashMarkers } from '../map/ClusteredKlashMarkers'
import { MapTiles } from '../map/MapTiles'
import { ServiceAreaBounds } from '../map/ServiceAreaBounds'
import { useKlashesInBbox } from '../map/useKlashesInBbox'
import { readStoredMapLayer } from '../map/useMapLayer'
import {
  INITIAL_MAP_CENTER,
  MAX_MAP_ZOOM,
  MAX_SATELLITE_MAP_ZOOM,
  MIN_MAP_ZOOM,
} from '../../config/serviceArea'
import { useServiceArea } from '../../config/useServiceArea'
import { fr } from '../../i18n/fr'
import { useAuth } from '../auth/useAuth'
import type { Klash } from '../../types/klash'
import { isPointInBbox, type Bbox } from '../../utils/bbox'
import { mapWithConcurrency } from '../../utils/mapWithConcurrency'

const NEW_KLASH_MAP_ZOOM = MAX_MAP_ZOOM - 2
// Same reasoning and value as KlashFormStep's PHOTO_CONCURRENCY: bounded so
// up to MAX_PHOTOS_PER_KLASH uploads don't all race the network at once.
const PHOTO_UPLOAD_CONCURRENCY = 4

function noop() {
  // ClusteredKlashMarkers requires an onSelect handler, but markers here are
  // purely contextual (showing what's already nearby while placing the pin)
  // — the creation sheet already occupies the bottom of the screen.
}

type Step = 'resume' | 'position' | 'duplicates' | 'form' | 'submit' | 'done'

type PendingAction = { type: 'create'; form: NewKlashForm } | { type: 'confirm'; klashId: string }

function parseCoord(value: string | null, fallback: number): number {
  const parsed = value ? Number.parseFloat(value) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Creation sheet (spec §6.2), a real route with its own map so the pin stays
 * visible behind the sheet.
 *
 * The form draft and selected photos live here, not inside KlashFormStep,
 * even though only KlashFormStep renders them: accepting a photo's EXIF GPS
 * position (step 3) re-runs duplicate detection at the new position (step
 * 2), which unmounts KlashFormStep. Lifting its state up is what lets the
 * user land back on the form with everything they typed still there.
 *
 * This same state is what `useDraftAutosave` persists locally (see
 * `docs/plans/ameliorations-3-brouillon.md`), so a report survives an
 * accidental navigation away, a reload, or the tab being closed. */
export function NewKlashPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const initialLat = parseCoord(searchParams.get('lat'), INITIAL_MAP_CENTER[0])
  const initialLng = parseCoord(searchParams.get('lng'), INITIAL_MAP_CENTER[1])

  // Only apply the geolocation result if the page opened without an explicit
  // ?lat=&lng= (e.g. from the "Signaler ici" floating button, which already
  // supplied a position) — otherwise it would override a long-press point.
  const hasExplicitPosition = searchParams.has('lat') && searchParams.has('lng')

  // Needed before the draft-restore decision below, so it's called here
  // rather than further down alongside the other map-data hooks: an
  // unconditional, side-effect-free hook call, safe to reorder. A draft
  // whose saved position has fallen outside the service area (the area can
  // shrink between save and restore, and the pin stays draggable at the
  // 'form' step, so a draft can be saved already out of area) must not skip
  // spec §6.2's out-of-area gate on restore.
  const serviceArea = useServiceArea()

  // Read once, at mount: a later save by useDraftAutosave must not make this
  // component think there's a *different* draft to offer mid-session — this
  // is "what was on disk when the page opened", not a live value.
  const [restorableDraft] = useState<StoredKlashDraft | null>(() => readStoredDraft())
  // An explicit position (map tap, "Signaler où je suis") conflicts with the
  // draft's own saved position — that ambiguity is resolved by DraftResumeStep
  // below rather than silently picking one. With no explicit position, the
  // draft — if any — is simply what this visit to /new is about.
  const shouldAutoRestoreDraft = restorableDraft !== null && !hasExplicitPosition
  const isRestorableDraftInArea =
    restorableDraft !== null && isPointInBbox(restorableDraft.lat, restorableDraft.lng, serviceArea)

  const [position, setPosition] = useState<[number, number]>(() =>
    shouldAutoRestoreDraft && restorableDraft
      ? [restorableDraft.lat, restorableDraft.lng]
      : [initialLat, initialLng],
  )
  const [step, setStep] = useState<Step>(() => {
    if (hasExplicitPosition && restorableDraft) return 'resume'
    if (shouldAutoRestoreDraft && restorableDraft) {
      return isRestorableDraftInArea ? restorableDraft.step : 'position'
    }
    return 'position'
  })
  const [formDraft, setFormDraft] = useState<KlashFormDraft>(() =>
    shouldAutoRestoreDraft && restorableDraft ? restorableDraft.form : emptyKlashFormDraft,
  )
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  // True while restoreDraftPhotos' IndexedDB read is in flight, so
  // useDraftAutosave's debounce can't fire against the not-yet-restored,
  // still-empty `photos` array and either wipe a photo-only draft or briefly
  // claim it has no photos while IndexedDB still holds them. Starts true
  // exactly when the auto-restore effect below will run.
  const [isRestoringPhotos, setIsRestoringPhotos] = useState(shouldAutoRestoreDraft)
  // Set only by handleResumeDraft, to recentre the map on a draft's saved
  // position — see MapRecenter's docblock for why this isn't just `position`.
  const [recenterTarget, setRecenterTarget] = useState<[number, number] | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [createdKlash, setCreatedKlash] = useState<Klash | null>(null)
  const [confirmedKlashId, setConfirmedKlashId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [failedPhotoCount, setFailedPhotoCount] = useState(0)
  const [viewportBbox, setViewportBbox] = useState<Bbox | null>(null)
  // Same layer (plan/satellite) as the main map the user just came from, so
  // placing the pin doesn't silently switch the imagery under them. Read once,
  // at mount: this page has no layer toggle, so the value can't change here,
  // which also lets maxZoom below be a plain static prop (no MapLayerZoom).
  const [mapLayer] = useState(readStoredMapLayer)
  const [isCancelSheetOpen, setIsCancelSheetOpen] = useState(false)

  // Guards runPendingAction against firing more than once for the same
  // pending action — see submitGuard.ts for the three ways that used to
  // happen. A ref, not state: the guard must reject a second caller in the
  // same synchronous tick, before a re-render could ever update state.
  const submitGuardRef = useRef(createSubmitGuard())

  const geolocation = useGeolocation()
  const { data: nearbyKlashes = [] } = useKlashesInBbox(viewportBbox, serviceArea)

  // hasExplicitPosition is computed above, alongside the draft-restore logic
  // that also depends on it — also skipped when a draft was auto-restored,
  // whose saved position must win over the device's current location just
  // like it wins over the default map center. Runs once the geolocation
  // result arrives; the position can still be moved freely afterwards via
  // the draggable pin.
  useEffect(() => {
    if (hasExplicitPosition || shouldAutoRestoreDraft || !geolocation.result) return
    setPosition([geolocation.result.lat, geolocation.result.lng])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geolocation.result])

  const isOutOfArea = !isPointInBbox(position[0], position[1], serviceArea)

  // Rebuilds PendingPhoto[] from IndexedDB for a draft being applied — either
  // automatically on mount (shouldAutoRestoreDraft) or via "Reprendre ma
  // déclaration" (handleResumeDraft). previewUrl is a *new* object URL: the
  // one recorded at save time died with the tab that created it. A photo
  // whose bytes failed to persist (see draftPhotoStore's docblocks) is
  // silently dropped rather than shown broken.
  //
  // isRestoringPhotos brackets the whole (async) call so useDraftAutosave's
  // debounce can't fire while `photos` is still the pre-restore, empty
  // array. The final setPhotos is a merge, not an overwrite, for the same
  // race from the other side: KlashFormStep is already interactive once the
  // 'form' step is mounted, so a photo the user adds while this is still in
  // flight must survive being restored over, not get silently dropped (and
  // its object URL leaked, since it would no longer be in the array
  // KlashFormStep's own unmount cleanup reads).
  async function restoreDraftPhotos(draft: StoredKlashDraft) {
    setIsRestoringPhotos(true)
    try {
      const files = await loadDraftPhotos()
      const restored: PendingPhoto[] = []
      for (const meta of draft.photos) {
        const file = files.get(meta.id)
        if (!file) continue
        restored.push({
          id: meta.id,
          compressed: { file, width: meta.width, height: meta.height },
          previewUrl: URL.createObjectURL(file),
          gps: meta.gps,
        })
      }
      setPhotos((current) => {
        const currentIds = new Set(current.map((photo) => photo.id))
        return [...restored.filter((photo) => !currentIds.has(photo.id)), ...current]
      })
    } finally {
      setIsRestoringPhotos(false)
    }
  }

  // Auto-restore path only: runs once, mirroring the geolocation effect's
  // pattern above. The resume-button path calls restoreDraftPhotos directly
  // from handleResumeDraft instead, since it fires on a user action, not on
  // mount.
  useEffect(() => {
    if (shouldAutoRestoreDraft && restorableDraft) void restoreDraftPhotos(restorableDraft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { suppressPendingSave } = useDraftAutosave({
    enabled:
      (step === 'position' || step === 'duplicates' || step === 'form') && !isRestoringPhotos,
    lat: position[0],
    lng: position[1],
    step: step === 'duplicates' ? 'duplicates' : step === 'form' ? 'form' : 'position',
    form: formDraft,
    photos,
  })

  function handleResumeDraft() {
    if (!restorableDraft) return
    const resumedPosition: [number, number] = [restorableDraft.lat, restorableDraft.lng]
    setPosition(resumedPosition)
    setRecenterTarget(resumedPosition)
    setFormDraft(restorableDraft.form)
    setStep(isRestorableDraftInArea ? restorableDraft.step : 'position')
    void restoreDraftPhotos(restorableDraft)
  }

  function handleStartNewHere() {
    clearStoredDraft()
    void clearDraftPhotos()
    setStep('position')
  }

  // Cancelling loses nothing worth keeping (an untouched form, no photos) —
  // leave immediately, as before. Otherwise ask, so an accidental tap or
  // back-navigation doesn't silently discard a report worth resuming.
  function handleCancel() {
    if (isDraftWorthKeeping(formDraft, photos.length)) {
      setIsCancelSheetOpen(true)
    } else {
      navigate('/')
    }
  }

  function handleKeepDraftAndLeave() {
    setIsCancelSheetOpen(false)
    navigate('/')
  }

  function handleDiscardDraftAndLeave() {
    setIsCancelSheetOpen(false)
    suppressPendingSave()
    clearStoredDraft()
    void clearDraftPhotos()
    navigate('/')
  }

  // A photo's EXIF position was accepted: move the pin and re-run duplicate
  // detection there (its query key includes lat/lng, so this can't serve a
  // stale answer from the old position) — the form draft and photos survive
  // since they live in this component, not in the unmounted form step.
  function handleUsePhotoPosition(lat: number, lng: number) {
    setPosition([lat, lng])
    setStep('duplicates')
  }

  async function runPendingAction(action: PendingAction) {
    // Both SubmitStep's onReady effect and startAction's own call below can
    // reach here for the same tap; only the first is let through. Released
    // on failure (below) so a retry after a real error isn't locked out.
    if (!submitGuardRef.current.claim()) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      if (action.type === 'confirm') {
        if (!user) throw new Error('Cannot confirm while signed out')
        await confirmKlash(action.klashId, user.id)
        setConfirmedKlashId(action.klashId)
      } else {
        if (!user) throw new Error('Cannot create a klash while signed out')
        const klash = await createKlash({
          lat: position[0],
          lng: position[1],
          category: action.form.category,
          categoryOther: action.form.categoryOther,
          importance: action.form.importance,
          title: action.form.title,
          description: action.form.description,
          proposedSolution: action.form.proposedSolution,
        })
        setCreatedKlash(klash)

        // Photos upload after the klash exists (spec §6.2 step 4), with bounded
        // concurrency (PHOTO_UPLOAD_CONCURRENCY) rather than all at once — at up
        // to MAX_PHOTOS_PER_KLASH photos, uploading every one simultaneously on a
        // phone in 4G would risk the acceptance criterion's 10s budget. A failed
        // photo doesn't roll back the klash (a report without a photo still has
        // value); the done screen reports how many failed instead — so each
        // upload is caught individually rather than left to reject the batch.
        const results = await mapWithConcurrency(
          photos,
          PHOTO_UPLOAD_CONCURRENCY,
          async (photo) => {
            try {
              await uploadKlashPhoto(klash.id, user.id, photo.compressed)
              return { status: 'fulfilled' } as const
            } catch {
              return { status: 'rejected' } as const
            }
          },
        )
        const failedCount = results.filter((result) => result.status === 'rejected').length
        setFailedPhotoCount(failedCount)

        void queryClient.invalidateQueries({ queryKey: klashKeys.all })
      }
      // The report this draft was tracking is now either a real klash or a
      // confirmation on an existing one — either way, "in progress" is over.
      suppressPendingSave()
      clearStoredDraft()
      void clearDraftPhotos()
      setStep('done')
    } catch (error) {
      submitGuardRef.current.release()
      setSubmitError(mapSubmitError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Only trigger: mounting SubmitStep runs its onReady effect once signed in
  // (immediately, if already signed in) — see SubmitStep's docblock. This
  // used to also call runPendingAction directly here, racing that effect for
  // the same action; the guard above would still have caught it, but one
  // caller is simpler than two and a guard.
  function startAction(action: PendingAction) {
    submitGuardRef.current = createSubmitGuard()
    setPendingAction(action)
    setSubmitError(null)
    setStep('submit')
  }

  return (
    <div className="relative h-dvh w-full">
      <MapContainer
        center={position}
        zoom={NEW_KLASH_MAP_ZOOM}
        minZoom={MIN_MAP_ZOOM}
        maxZoom={mapLayer === 'satellite' ? MAX_SATELLITE_MAP_ZOOM : MAX_MAP_ZOOM}
        bounceAtZoomLimits={false}
        maxBoundsViscosity={1}
        className="h-full w-full"
      >
        <MapTiles layer={mapLayer} />
        <ServiceAreaBounds bbox={serviceArea} />
        <BboxWatcher onChange={setViewportBbox} />
        <ClusteredKlashMarkers klashes={nearbyKlashes} onSelect={noop} />
        <DraggablePin position={position} onMove={(lat, lng) => setPosition([lat, lng])} />
        <MapRecenter position={recenterTarget} />
      </MapContainer>

      <BottomSheet scrollable>
        {step === 'resume' && restorableDraft && (
          <DraftResumeStep
            savedAt={restorableDraft.savedAt}
            onResume={handleResumeDraft}
            onStartNew={handleStartNewHere}
            onCancel={handleCancel}
          />
        )}

        {step === 'position' && (
          <PositionStep
            accuracyM={geolocation.result?.accuracyM ?? null}
            isOutOfArea={isOutOfArea}
            onContinue={() => setStep('duplicates')}
            onCancel={handleCancel}
          />
        )}

        {step === 'duplicates' && (
          <DuplicatesStep
            lat={position[0]}
            lng={position[1]}
            onSameProblem={(klash) => startAction({ type: 'confirm', klashId: klash.id })}
            onDifferentProblem={() => setStep('form')}
            onCancel={handleCancel}
          />
        )}

        {step === 'form' && (
          <KlashFormStep
            value={formDraft}
            onChange={setFormDraft}
            photos={photos}
            onPhotosChange={setPhotos}
            pinLat={position[0]}
            pinLng={position[1]}
            onUsePhotoPosition={handleUsePhotoPosition}
            onSubmit={(form) => startAction({ type: 'create', form })}
            onCancel={handleCancel}
          />
        )}

        {step === 'submit' && pendingAction && (
          <SubmitStep
            isPending={isSubmitting}
            errorMessage={submitError}
            onReady={() => void runPendingAction(pendingAction)}
          />
        )}

        {step === 'done' && (
          <DoneStep
            createdKlash={createdKlash}
            confirmedKlashId={confirmedKlashId}
            failedPhotoCount={failedPhotoCount}
            onViewKlash={(id) => navigate(`/k/${id}`)}
            onBackToMap={() => navigate('/')}
          />
        )}
      </BottomSheet>

      {isCancelSheetOpen && (
        <CancelDraftSheet
          onKeep={handleKeepDraftAndLeave}
          onDiscard={handleDiscardDraftAndLeave}
          onDismiss={() => setIsCancelSheetOpen(false)}
        />
      )}
    </div>
  )
}

function mapSubmitError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('location outside service area')) {
    return fr.newKlash.submit.outOfAreaError
  }
  if (message.includes('rate limit exceeded')) {
    return fr.newKlash.submit.rateLimitError
  }
  if (message.includes('duplicate klash')) {
    return fr.newKlash.submit.duplicateError
  }
  return fr.newKlash.submit.submitError
}

function DoneStep({
  createdKlash,
  confirmedKlashId,
  failedPhotoCount,
  onViewKlash,
  onBackToMap,
}: {
  createdKlash: Klash | null
  confirmedKlashId: string | null
  failedPhotoCount: number
  onViewKlash: (id: string) => void
  onBackToMap: () => void
}) {
  const isConfirmation = confirmedKlashId !== null

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h2 className="text-lg font-semibold text-neutral-900">
        {isConfirmation ? fr.newKlash.duplicates.confirmed : fr.newKlash.submit.done.title}
      </h2>
      {!isConfirmation && (
        <p className="text-sm text-neutral-600">{fr.newKlash.submit.done.body}</p>
      )}
      {!isConfirmation && failedPhotoCount > 0 && (
        <p className="text-sm text-amber-700">
          {fr.newKlash.submit.done.photoUploadPartialError(failedPhotoCount)}
        </p>
      )}
      <div className="flex w-full flex-col gap-2">
        {(createdKlash ?? confirmedKlashId) && (
          <button
            type="button"
            onClick={() => onViewKlash((createdKlash?.id ?? confirmedKlashId) as string)}
            className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            {fr.newKlash.submit.done.viewIt}
          </button>
        )}
        <button
          type="button"
          onClick={onBackToMap}
          className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.newKlash.submit.done.backToMap}
        </button>
      </div>
    </div>
  )
}
