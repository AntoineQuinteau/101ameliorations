import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchKlashPhotos, klashPhotoPublicUrl } from '../../api/klashPhotos'
import { klashKeys } from '../../api/queryKeys'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'

/** Photo gallery for the detail page (spec §6.3): a thumbnail grid, and a
 * full-screen viewer on tap. Renders nothing if the klash has no photo — no
 * placeholder, no empty-state message. */
export function KlashPhotoGallery({ klashId }: { klashId: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const {
    data: photos = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: klashKeys.photos(klashId),
    queryFn: () => fetchKlashPhotos(klashId),
  })

  if (isLoading) return <Spinner />
  if (isError) {
    return <ErrorMessage message={fr.detail.photosLoadError} onRetry={() => refetch()} />
  }
  if (photos.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="aspect-square overflow-hidden rounded-lg ring-1 ring-black/10"
          >
            <img
              src={klashPhotoPublicUrl(photo.storagePath)}
              alt={fr.detail.photoAlt(index + 1)}
              width={photo.width ?? undefined}
              height={photo.height ?? undefined}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  )
}

function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: { id: string; storagePath: string }[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  // Same "sibling of MapContainer, not a portal" overlay pattern as
  // KlashPreviewCard/PinConfirmCard, extended here with keyboard support
  // (Escape to close, arrows to navigate) since a full-screen overlay with
  // no keyboard escape is a dead end for anyone not using a mouse.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onIndexChange((index + 1) % photos.length)
      if (event.key === 'ArrowLeft') onIndexChange((index - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index, photos.length, onIndexChange, onClose])

  const photo = photos[index]
  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={fr.detail.closePhoto}
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl leading-none text-white hover:bg-white/20"
      >
        ×
      </button>

      {photos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onIndexChange((index - 1 + photos.length) % photos.length)
            }}
            aria-label={fr.detail.previousPhoto}
            className="absolute left-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl leading-none text-white hover:bg-white/20"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onIndexChange((index + 1) % photos.length)
            }}
            aria-label={fr.detail.nextPhoto}
            className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl leading-none text-white hover:bg-white/20"
          >
            ›
          </button>
        </>
      )}

      <img
        src={klashPhotoPublicUrl(photo.storagePath)}
        alt={fr.detail.photoAlt(index + 1)}
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-full rounded-md object-contain"
      />
    </div>
  )
}
