import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchKlashPhotos, klashPhotoPublicUrl } from '../../api/klashPhotos'
import { klashKeys } from '../../api/queryKeys'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { MAX_PHOTOS_PER_KLASH } from '../../config/photos'
import { fr } from '../../i18n/fr'
import { mapWithConcurrency } from '../../utils/mapWithConcurrency'
import { compressPhoto } from '../../utils/photoCompression'
import { useHasHover } from '../map/useHasHover'
import { PhotoSourceSheet } from '../newKlash/PhotoSourceSheet'
import { useAddKlashPhotos, useDeleteKlashPhoto } from './useKlashPhotoMutations'

// Same reasoning as KlashFormStep's PHOTO_CONCURRENCY: bounded so several
// compressions don't all run at once and risk the acceptance budget.
const PHOTO_CONCURRENCY = 4

/** Photo management inside the edit form (spec §6.3 "Modifier"): add or
 * remove photos on an existing klash. Unlike the creation flow's photo
 * picker (KlashFormStep), every action here writes immediately — see
 * EditKlashForm's docblock for why — so there is no local pending list and
 * no EXIF GPS prompt (there is no pin to move). */
export function KlashPhotoEditor({ klashId }: { klashId: string }) {
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const [addPartialErrorCount, setAddPartialErrorCount] = useState(0)
  const [isPhotoSourceOpen, setIsPhotoSourceOpen] = useState(false)
  const hasHover = useHasHover()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const {
    data: photos = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: klashKeys.photos(klashId),
    queryFn: () => fetchKlashPhotos(klashId),
  })

  const addPhotos = useAddKlashPhotos(klashId)
  const deletePhoto = useDeleteKlashPhoto(klashId)

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    // Sliced against the server-side count (this query), not a local
    // array: enforce_photo_limit() counts every photo on the klash,
    // including ones another staff member added since this page loaded.
    const files = Array.from(fileList).slice(0, MAX_PHOTOS_PER_KLASH - photos.length)
    setPickError(null)
    setAddPartialErrorCount(0)
    setIsProcessingPhoto(true)
    try {
      const compressed = await mapWithConcurrency(files, PHOTO_CONCURRENCY, compressPhoto)
      addPhotos.mutate(compressed, {
        onSuccess: ({ failedCount }) => setAddPartialErrorCount(failedCount),
      })
    } catch {
      setPickError(fr.newKlash.form.photoError)
    } finally {
      setIsProcessingPhoto(false)
    }
  }

  function handleAddPhotoClick() {
    if (hasHover) {
      galleryInputRef.current?.click()
    } else {
      setIsPhotoSourceOpen(true)
    }
  }

  function handleRemovePhoto(photo: { id: string; storagePath: string }) {
    if (!window.confirm(fr.detail.edit.removePhotoConfirm)) return
    deletePhoto.mutate(photo)
  }

  if (isLoading) return <Spinner />
  if (isError) {
    return <ErrorMessage message={fr.detail.photosLoadError} onRetry={() => refetch()} />
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-neutral-700">{fr.detail.edit.photosLabel}</span>
      <p className="text-xs text-neutral-500">{fr.detail.edit.photosNotice}</p>

      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative h-16 w-16 shrink-0">
              <img
                src={klashPhotoPublicUrl(photo.storagePath)}
                alt={fr.detail.photoAlt(index + 1)}
                className="h-16 w-16 rounded-md object-cover ring-1 ring-black/10"
              />
              <button
                type="button"
                onClick={() => handleRemovePhoto(photo)}
                disabled={deletePhoto.isPending}
                aria-label={fr.detail.edit.removePhoto}
                className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900/80 text-xs leading-none text-white hover:bg-neutral-900 disabled:opacity-60"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < MAX_PHOTOS_PER_KLASH ? (
        <>
          <button
            type="button"
            onClick={handleAddPhotoClick}
            disabled={isProcessingPhoto || addPhotos.isPending}
            className="inline-flex w-fit items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessingPhoto || addPhotos.isPending
              ? fr.newKlash.form.compressing
              : fr.newKlash.form.addPhoto}
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            disabled={isProcessingPhoto || addPhotos.isPending}
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
            disabled={isProcessingPhoto || addPhotos.isPending}
            onChange={(event) => {
              void handleFilesSelected(event.target.files)
              event.target.value = ''
            }}
            className="sr-only"
          />
        </>
      ) : (
        <p className="text-xs text-neutral-500">
          {fr.newKlash.form.photoLimitReached(MAX_PHOTOS_PER_KLASH)}
        </p>
      )}

      {pickError && <ErrorMessage message={pickError} />}
      {addPhotos.isError && <ErrorMessage message={fr.detail.edit.addPhotoError} />}
      {addPartialErrorCount > 0 && (
        <ErrorMessage message={fr.detail.edit.addPhotoPartialError(addPartialErrorCount)} />
      )}
      {deletePhoto.isError && <ErrorMessage message={fr.detail.edit.removePhotoError} />}

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
    </div>
  )
}
