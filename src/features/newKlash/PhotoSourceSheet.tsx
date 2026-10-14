import { Modal } from '../../components/Modal'
import { fr } from '../../i18n/fr'

/** Camera-or-gallery choice, shown on touch devices when adding a photo (spec §6.2,
 * `docs/spec.md:206`). A `Modal` rather than `BottomSheet`: that can't nest — `NewKlashPage`
 * already wraps the whole creation flow in one. Backdrop click and Escape cancel. */
export function PhotoSourceSheet({
  onPickCamera,
  onPickGallery,
  onCancel,
}: {
  onPickCamera: () => void
  onPickGallery: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      ariaLabel={fr.newKlash.form.photoSourceTitle}
      onClose={onCancel}
      contentClassName="flex flex-col gap-2 p-4"
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
    </Modal>
  )
}
