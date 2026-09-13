import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import { DraggablePin } from './DraggablePin'
import { DuplicatesStep } from './DuplicatesStep'
import { KlashFormStep, type PendingPhoto } from './KlashFormStep'
import { PositionStep } from './PositionStep'
import { SubmitStep } from './SubmitStep'
import { useGeolocation } from './useGeolocation'
import { emptyKlashFormDraft, type KlashFormDraft, type NewKlashForm } from './newKlashSchemas'
import { createSubmitGuard } from './submitGuard'
import { confirmKlash } from '../../api/confirmations'
import { createKlash } from '../../api/klashes'
import { uploadKlashPhoto } from '../../api/klashPhotos'
import { klashKeys } from '../../api/queryKeys'
import { BboxWatcher } from '../map/BboxWatcher'
import { ClusteredKlashMarkers } from '../map/ClusteredKlashMarkers'
import { MapTiles } from '../map/MapTiles'
import { useKlashesInBbox } from '../map/useKlashesInBbox'
import {
  INITIAL_MAP_CENTER,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  SERVICE_AREA_BBOX,
} from '../../config/serviceArea'
import { fr } from '../../i18n/fr'
import { useAuth } from '../auth/useAuth'
import type { Klash } from '../../types/klash'
import { expandBbox, isPointInBbox, type Bbox } from '../../utils/bbox'

const NEW_KLASH_MAP_ZOOM = MAX_MAP_ZOOM - 2

function noop() {
  // ClusteredKlashMarkers requires an onSelect handler, but markers here are
  // purely contextual (showing what's already nearby while placing the pin)
  // — the creation sheet already occupies the bottom of the screen.
}

type Step = 'position' | 'duplicates' | 'form' | 'submit' | 'done'

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
 * user land back on the form with everything they typed still there. */
export function NewKlashPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const initialLat = parseCoord(searchParams.get('lat'), INITIAL_MAP_CENTER[0])
  const initialLng = parseCoord(searchParams.get('lng'), INITIAL_MAP_CENTER[1])

  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng])
  const [step, setStep] = useState<Step>('position')
  const [formDraft, setFormDraft] = useState<KlashFormDraft>(emptyKlashFormDraft)
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [createdKlash, setCreatedKlash] = useState<Klash | null>(null)
  const [confirmedKlashId, setConfirmedKlashId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [failedPhotoCount, setFailedPhotoCount] = useState(0)
  const [viewportBbox, setViewportBbox] = useState<Bbox | null>(null)

  // Guards runPendingAction against firing more than once for the same
  // pending action — see submitGuard.ts for the three ways that used to
  // happen. A ref, not state: the guard must reject a second caller in the
  // same synchronous tick, before a re-render could ever update state.
  const submitGuardRef = useRef(createSubmitGuard())

  const geolocation = useGeolocation()
  const { data: nearbyKlashes = [] } = useKlashesInBbox(viewportBbox)

  // Only apply the geolocation result if the page opened without an explicit
  // ?lat=&lng= (e.g. from the "Signaler ici" floating button, which already
  // supplied a position) — otherwise it would override a long-press point.
  // Runs once the geolocation result arrives; the position can still be
  // moved freely afterwards via the draggable pin.
  const hasExplicitPosition = searchParams.has('lat') && searchParams.has('lng')
  useEffect(() => {
    if (hasExplicitPosition || !geolocation.result) return
    setPosition([geolocation.result.lat, geolocation.result.lng])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geolocation.result])

  const isOutOfArea = !isPointInBbox(position[0], position[1], SERVICE_AREA_BBOX)

  const maxBounds = useMemo<LatLngBoundsExpression>(() => {
    const padded = expandBbox(SERVICE_AREA_BBOX, 0.1)
    return [
      [padded.minLat, padded.minLng],
      [padded.maxLat, padded.maxLng],
    ]
  }, [])

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
          urgency: action.form.urgency,
          title: action.form.title,
          description: action.form.description,
        })
        setCreatedKlash(klash)

        // Photos upload after the klash exists (spec §6.2 step 4), in
        // parallel so 3 photos don't serialize into 3x the wait — this and
        // the compression web worker are what keep the whole flow under the
        // acceptance criterion's 10s budget. A failed photo doesn't roll
        // back the klash (a report without a photo still has value); the
        // done screen reports how many failed instead.
        const results = await Promise.allSettled(
          photos.map((photo) => uploadKlashPhoto(klash.id, user.id, photo.compressed)),
        )
        const failedCount = results.filter((result) => result.status === 'rejected').length
        setFailedPhotoCount(failedCount)

        void queryClient.invalidateQueries({ queryKey: klashKeys.all })
      }
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
        maxZoom={MAX_MAP_ZOOM}
        maxBounds={maxBounds}
        maxBoundsViscosity={1}
        className="h-full w-full"
      >
        <MapTiles />
        <BboxWatcher onChange={setViewportBbox} />
        <ClusteredKlashMarkers klashes={nearbyKlashes} onSelect={noop} />
        <DraggablePin position={position} onMove={(lat, lng) => setPosition([lat, lng])} />
      </MapContainer>

      <div className="absolute inset-x-0 bottom-0 z-[1000] mx-auto w-full max-w-md p-3 sm:bottom-4">
        <div className="max-h-[70vh] overflow-y-auto rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
          {step === 'position' && (
            <PositionStep
              accuracyM={geolocation.result?.accuracyM ?? null}
              isOutOfArea={isOutOfArea}
              onContinue={() => setStep('duplicates')}
              onCancel={() => navigate('/')}
            />
          )}

          {step === 'duplicates' && (
            <DuplicatesStep
              lat={position[0]}
              lng={position[1]}
              onSameProblem={(klash) => startAction({ type: 'confirm', klashId: klash.id })}
              onDifferentProblem={() => setStep('form')}
              onCancel={() => navigate('/')}
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
              onCancel={() => navigate('/')}
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
        </div>
      </div>
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
