import { useEffect } from 'react'
import { fr } from '../../i18n/fr'

/** Camera-or-gallery choice, shown on touch devices when adding a photo (spec §6.2,
 * `docs/spec.md:206`). `BottomSheet` can't nest — `NewKlashPage` already wraps the whole
 * creation flow in one — so this reuses `PhotoLightbox`'s pattern instead
 * (`KlashPhotoGallery.tsx`), the only other full-screen overlay in the app: a plain
 * `fixed inset-0` sibling of the sheet, not a portal, closed by a background click or
 * Escape. There's no shared Modal/Dialog component in the repo to reach for either —
 * two buttons in an overlay don't need one. */
export function PhotoSourceSheet({
  onPickCamera,
  onPickGallery,
  onCancel,
}: {
  onPickCamera: () => void
  onPickGallery: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={fr.newKlash.form.photoSourceTitle}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-2 rounded-xl bg-white p-4 shadow-lg"
      >
        <h2 className="text-center text-sm font-medium text-neutral-700">
          {fr.newKlash.form.photoSourceTitle}
        </h2>
        <button
          type="button"
          onClick={onPickCamera}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {fr.newKlash.form.photoSourceCamera}
        </button>
        <button
          type="button"
          onClick={onPickGallery}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.newKlash.form.photoSourceGallery}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-1 inline-flex min-h-11 items-center justify-center px-3 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          {fr.newKlash.form.photoSourceCancel}
        </button>
      </div>
    </div>
  )
}
