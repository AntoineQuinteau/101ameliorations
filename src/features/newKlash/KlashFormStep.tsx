import { useEffect, useRef, useState } from 'react'
import { KlashFieldset } from './KlashFieldset'
import { PhotoSourceSheet } from './PhotoSourceSheet'
import { createSubmitGuard } from './submitGuard'
import { ErrorMessage } from '../../components/ErrorMessage'
import { MAX_PHOTOS_PER_KLASH } from '../../config/photos'
import { fr } from '../../i18n/fr'
import { useHasHover } from '../map/useHasHover'
import { distanceMeters } from '../../utils/distance'
import { mapWithConcurrency } from '../../utils/mapWithConcurrency'
import { compressPhoto, readPhotoGps, type CompressedPhoto } from '../../utils/photoCompression'
import {
  messageForKlashFormIssue,
  newKlashFormSchema,
  type KlashFormDraft,
  type NewKlashForm,
} from './newKlashSchemas'

const MAX_PHOTOS = MAX_PHOTOS_PER_KLASH
// Compression and upload both run with this many photos in flight at once,
// not all 12 at once: on a phone in 4G that would risk the 10s acceptance
// budget (spec §9 step 5).
const PHOTO_CONCURRENCY = 4
// Below this, a photo's GPS position is close enough to the pin (well under
// the 50m duplicate-detection radius) that offering to move the pin isn't
// worth the interruption.
const EXIF_GPS_PROMPT_THRESHOLD_M = 25

export interface PendingPhoto {
  id: string
  compressed: CompressedPhoto
  previewUrl: string
  gps: { lat: number; lng: number } | null
}

export function KlashFormStep({
  value,
  onChange,
  photos,
  onPhotosChange,
  pinLat,
  pinLng,
  onUsePhotoPosition,
  onSubmit,
  onCancel,
}: {
  value: KlashFormDraft
  onChange: (value: KlashFormDraft) => void
  photos: PendingPhoto[]
  onPhotosChange: (photos: PendingPhoto[]) => void
  pinLat: number
  pinLng: number
  onUsePhotoPosition: (lat: number, lng: number) => void
  onSubmit: (form: NewKlashForm) => void
  onCancel: () => void
}) {
  const [validationError, setValidationError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isPhotoSourceOpen, setIsPhotoSourceOpen] = useState(false)
  const hasHover = useHasHover()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  // Guards against a double-tap submitting twice: onSubmit() below leads the
  // parent to unmount this step, but that unmount only takes effect on the
  // next render — a second click dispatched in the same tick would still
  // reach handleSubmit first. A ref-backed guard (see submitGuard.ts) closes
  // that gap synchronously; `hasSubmitted` state only drives the disabled
  // button style.
  const submitGuardRef = useRef(createSubmitGuard())

  // Object URLs are created as photos are added; revoke whatever's left on
  // unmount (e.g. the EXIF-GPS prompt sending the flow back through the
  // duplicates step, which unmounts this component while photos are still
  // pending). A ref, not the `photos` prop, is what the cleanup reads: an
  // effect with an empty dependency array only ever closes over the value
  // from the first render, which would always be the initial empty list.
  const photosRef = useRef(photos)
  photosRef.current = photos
  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.previewUrl)
    }
  }, [])

  const gpsPrompt = photos
    .map((photo) => {
      if (!photo.gps) return null
      const distance = distanceMeters(pinLat, pinLng, photo.gps.lat, photo.gps.lng)
      return distance > EXIF_GPS_PROMPT_THRESHOLD_M ? { photo, distance } : null
    })
    .find((entry) => entry !== null)

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList).slice(0, MAX_PHOTOS - photos.length)
    setPhotoError(null)
    setIsProcessingPhoto(true)
    try {
      // Files process with bounded concurrency, not one after another and not all
      // at once: sequential EXIF reads + compressions would be the more likely
      // place to blow the 10s acceptance budget, but at up to 12 photos, running
      // every compression at once would risk it too (see PHOTO_CONCURRENCY).
      const added = await mapWithConcurrency(files, PHOTO_CONCURRENCY, async (file) => {
        const gps = await readPhotoGps(file) // must run before compression strips EXIF
        const compressed = await compressPhoto(file)
        const photo: PendingPhoto = {
          id: crypto.randomUUID(),
          compressed,
          previewUrl: URL.createObjectURL(compressed.file),
          gps,
        }
        return photo
      })
      onPhotosChange([...photos, ...added])
    } catch {
      setPhotoError(fr.newKlash.form.photoError)
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  function handleAddPhotoClick() {
    if (hasHover) {
      // No camera to speak of on a desktop with a mouse/trackpad — skip
      // straight to the file picker rather than offering a meaningless choice.
      galleryInputRef.current?.click()
    } else {
      setIsPhotoSourceOpen(true)
    }
  }

  function handleRemovePhoto(id: string) {
    const removed = photos.find((photo) => photo.id === id)
    if (removed) URL.revokeObjectURL(removed.previewUrl)
    onPhotosChange(photos.filter((photo) => photo.id !== id))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!submitGuardRef.current.claim()) return
    const result = newKlashFormSchema.safeParse({
      category: value.category === '' ? undefined : value.category,
      categoryOther: value.categoryOther.trim() === '' ? null : value.categoryOther,
      urgency: value.urgency,
      title: value.title,
      description: value.description.trim() === '' ? null : value.description,
      proposedSolution: value.proposedSolution.trim() === '' ? null : value.proposedSolution,
    })
    if (!result.success) {
      const issue = result.error.issues[0]
      setValidationError(messageForKlashFormIssue(issue?.path[0]))
      submitGuardRef.current.release() // invalid — let the user fix it and resubmit
      return
    }
    setValidationError(null)
    setHasSubmitted(true)
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-neutral-900">{fr.newKlash.form.title}</h2>

      <KlashFieldset value={value} onChange={onChange} idPrefix="new-klash" />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-700">{fr.newKlash.form.photosLabel}</span>

        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative h-16 w-16 shrink-0">
                <img
                  src={photo.previewUrl}
                  alt=""
                  className="h-16 w-16 rounded-md object-cover ring-1 ring-black/10"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(photo.id)}
                  aria-label={fr.newKlash.form.removePhoto}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900/80 text-xs leading-none text-white hover:bg-neutral-900"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < MAX_PHOTOS ? (
          <>
            <button
              type="button"
              onClick={handleAddPhotoClick}
              disabled={isProcessingPhoto}
              className="inline-flex w-fit items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isProcessingPhoto ? fr.newKlash.form.compressing : fr.newKlash.form.addPhoto}
            </button>
            {/* Two separate inputs, not one whose `capture` is toggled before
                `.click()`: mutating an attribute and firing the click in the
                same tick is exactly the kind of thing Safari iOS handles
                inconsistently. Neither is rendered inside the sheet below —
                a hidden `<input>` still receives `.click()` while unmounted
                from view but present in the DOM. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              disabled={isProcessingPhoto}
              onChange={(event) => {
                void handleFilesSelected(event.target.files)
                event.target.value = ''
              }}
              className="sr-only"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={isProcessingPhoto}
              onChange={(event) => {
                void handleFilesSelected(event.target.files)
                event.target.value = ''
              }}
              className="sr-only"
            />
          </>
        ) : (
          <p className="text-xs text-neutral-500">
            {fr.newKlash.form.photoLimitReached(MAX_PHOTOS)}
          </p>
        )}

        {photoError && <ErrorMessage message={photoError} />}

        {gpsPrompt && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              {fr.newKlash.form.exifGpsPrompt(gpsPrompt.distance)}
            </p>
            <button
              type="button"
              onClick={() =>
                gpsPrompt.photo.gps &&
                onUsePhotoPosition(gpsPrompt.photo.gps.lat, gpsPrompt.photo.gps.lng)
              }
              className="inline-flex w-fit items-center justify-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              {fr.newKlash.form.exifGpsUsePosition}
            </button>
          </div>
        )}
      </div>

      {validationError && <ErrorMessage message={validationError} />}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.newKlash.cancel}
        </button>
        <button
          type="submit"
          disabled={hasSubmitted}
          className="flex-1 inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {fr.newKlash.form.submit}
        </button>
      </div>

      {isPhotoSourceOpen && (
        <PhotoSourceSheet
          onPickCamera={() => {
            setIsPhotoSourceOpen(false)
            cameraInputRef.current?.click()
          }}
          onPickGallery={() => {
            setIsPhotoSourceOpen(false)
            galleryInputRef.current?.click()
          }}
          onCancel={() => setIsPhotoSourceOpen(false)}
        />
      )}
    </form>
  )
}
