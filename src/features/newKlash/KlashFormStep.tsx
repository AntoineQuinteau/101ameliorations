import { useEffect, useRef, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { fr } from '../../i18n/fr'
import type { KlashCategory, KlashUrgency } from '../../types/klash'
import { distanceMeters } from '../../utils/distance'
import { compressPhoto, readPhotoGps, type CompressedPhoto } from '../../utils/photoCompression'
import { newKlashFormSchema, type KlashFormDraft, type NewKlashForm } from './newKlashSchemas'

const CATEGORIES: KlashCategory[] = [
  'category_1',
  'category_2',
  'category_3',
  'category_4',
  'category_5',
]
const URGENCIES: KlashUrgency[] = ['low', 'medium', 'high']

const MAX_PHOTOS = 3
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
      // Files process in parallel, not one after another: sequential EXIF
      // reads + compressions would be the more likely place to blow the 10s
      // acceptance budget, ahead of the (already-parallel) upload step.
      const added = await Promise.all(
        files.map(async (file) => {
          const gps = await readPhotoGps(file) // must run before compression strips EXIF
          const compressed = await compressPhoto(file)
          const photo: PendingPhoto = {
            id: crypto.randomUUID(),
            compressed,
            previewUrl: URL.createObjectURL(compressed.file),
            gps,
          }
          return photo
        }),
      )
      onPhotosChange([...photos, ...added])
    } catch {
      setPhotoError(fr.newKlash.form.photoError)
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  function handleRemovePhoto(id: string) {
    const removed = photos.find((photo) => photo.id === id)
    if (removed) URL.revokeObjectURL(removed.previewUrl)
    onPhotosChange(photos.filter((photo) => photo.id !== id))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const result = newKlashFormSchema.safeParse({
      category: value.category,
      urgency: value.urgency,
      title: value.title,
      description: value.description.trim() === '' ? null : value.description,
    })
    if (!result.success) {
      const issue = result.error.issues[0]
      setValidationError(
        issue?.path[0] === 'description'
          ? fr.newKlash.form.invalidDescription
          : fr.newKlash.form.invalidTitle,
      )
      return
    }
    setValidationError(null)
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-neutral-900">{fr.newKlash.form.title}</h2>

      <div>
        <span className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.categoryLabel}
        </span>
        <div className="mt-1 grid grid-cols-5 gap-2">
          {CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange({ ...value, category: option })}
              aria-pressed={value.category === option}
              className={`rounded-md border px-2 py-2 text-xs font-medium ${
                value.category === option
                  ? 'border-teal-700 bg-teal-50 text-teal-800'
                  : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {fr.category[option]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.urgencyLabel}
        </span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {URGENCIES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange({ ...value, urgency: option })}
              aria-pressed={value.urgency === option}
              className={`rounded-md border px-2 py-2 text-xs font-medium ${
                value.urgency === option
                  ? 'border-teal-700 bg-teal-50 text-teal-800'
                  : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {fr.urgency[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-klash-title" className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.titleLabel}
        </label>
        <input
          id="new-klash-title"
          type="text"
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder={fr.newKlash.form.titlePlaceholder}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-klash-description" className="text-sm font-medium text-neutral-700">
          {fr.newKlash.form.descriptionLabel}
        </label>
        <textarea
          id="new-klash-description"
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
          placeholder={fr.newKlash.form.descriptionPlaceholder}
          rows={3}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        />
      </div>

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
          <label className="inline-flex w-fit cursor-pointer items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            {isProcessingPhoto ? fr.newKlash.form.compressing : fr.newKlash.form.addPhoto}
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              disabled={isProcessingPhoto}
              onChange={(event) => {
                void handleFilesSelected(event.target.files)
                event.target.value = ''
              }}
              className="sr-only"
            />
          </label>
        ) : (
          <p className="text-xs text-neutral-500">{fr.newKlash.form.photoLimitReached}</p>
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
          className="flex-1 inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {fr.newKlash.form.submit}
        </button>
      </div>
    </form>
  )
}
