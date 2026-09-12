import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import { DraggablePin } from './DraggablePin'
import { DuplicatesStep } from './DuplicatesStep'
import { KlashFormStep } from './KlashFormStep'
import { PositionStep } from './PositionStep'
import { SubmitStep } from './SubmitStep'
import { useGeolocation } from './useGeolocation'
import type { NewKlashForm } from './newKlashSchemas'
import { confirmKlash } from '../../api/confirmations'
import { createKlash } from '../../api/klashes'
import { MapTiles } from '../map/MapTiles'
import {
  INITIAL_MAP_CENTER,
  INITIAL_MAP_ZOOM,
  MAX_MAP_ZOOM,
  MIN_MAP_ZOOM,
  SERVICE_AREA_BBOX,
} from '../../config/serviceArea'
import { fr } from '../../i18n/fr'
import { useAuth } from '../auth/useAuth'
import type { Klash } from '../../types/klash'
import { expandBbox, isPointInBbox } from '../../utils/bbox'

type Step = 'position' | 'duplicates' | 'form' | 'submit' | 'done'

type PendingAction = { type: 'create'; form: NewKlashForm } | { type: 'confirm'; klashId: string }

function parseCoord(value: string | null, fallback: number): number {
  const parsed = value ? Number.parseFloat(value) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Creation sheet (spec §6.2), a real route with its own map so the pin stays
 * visible behind the sheet. No photos yet (step 5). */
export function NewKlashPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const initialLat = parseCoord(searchParams.get('lat'), INITIAL_MAP_CENTER[0])
  const initialLng = parseCoord(searchParams.get('lng'), INITIAL_MAP_CENTER[1])

  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng])
  const [step, setStep] = useState<Step>('position')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [createdKlash, setCreatedKlash] = useState<Klash | null>(null)
  const [confirmedKlashId, setConfirmedKlashId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const geolocation = useGeolocation()

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

  async function runPendingAction(action: PendingAction) {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      if (action.type === 'confirm') {
        if (!user) throw new Error('Cannot confirm while signed out')
        await confirmKlash(action.klashId, user.id)
        setConfirmedKlashId(action.klashId)
      } else {
        const klash = await createKlash({
          lat: position[0],
          lng: position[1],
          category: action.form.category,
          urgency: action.form.urgency,
          title: action.form.title,
          description: action.form.description,
        })
        setCreatedKlash(klash)
      }
      setStep('done')
    } catch (error) {
      setSubmitError(mapSubmitError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  function startAction(action: PendingAction) {
    setPendingAction(action)
    setSubmitError(null)
    setStep('submit')
    if (user) void runPendingAction(action)
  }

  return (
    <div className="relative h-dvh w-full">
      <MapContainer
        center={position}
        zoom={INITIAL_MAP_ZOOM}
        minZoom={MIN_MAP_ZOOM}
        maxZoom={MAX_MAP_ZOOM}
        maxBounds={maxBounds}
        maxBoundsViscosity={1}
        className="h-full w-full"
      >
        <MapTiles />
        <DraggablePin position={position} onMove={(lat, lng) => setPosition([lat, lng])} />
      </MapContainer>

      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label={fr.newKlash.cancel}
        className="absolute top-3 left-3 z-[1000] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-neutral-700 shadow hover:bg-white"
      >
        {fr.newKlash.cancel}
      </button>

      <div className="absolute inset-x-0 bottom-0 z-[1000] mx-auto w-full max-w-md p-3 sm:bottom-4">
        <div className="max-h-[70vh] overflow-y-auto rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
          {step === 'position' && (
            <PositionStep
              accuracyM={geolocation.result?.accuracyM ?? null}
              isOutOfArea={isOutOfArea}
              onContinue={() => setStep('duplicates')}
            />
          )}

          {step === 'duplicates' && (
            <DuplicatesStep
              lat={position[0]}
              lng={position[1]}
              onSameProblem={(klash) => startAction({ type: 'confirm', klashId: klash.id })}
              onDifferentProblem={() => setStep('form')}
            />
          )}

          {step === 'form' && (
            <KlashFormStep onSubmit={(form) => startAction({ type: 'create', form })} />
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
  return fr.newKlash.submit.submitError
}

function DoneStep({
  createdKlash,
  confirmedKlashId,
  onViewKlash,
  onBackToMap,
}: {
  createdKlash: Klash | null
  confirmedKlashId: string | null
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
