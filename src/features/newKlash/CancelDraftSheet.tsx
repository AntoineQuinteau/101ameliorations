import { Modal } from '../../components/Modal'
import { fr } from '../../i18n/fr'

/** Confirmation shown when cancelling a report that has something worth
 * keeping (spec follow-up: `docs/plans/ameliorations-3-brouillon.md`) —
 * offers to keep the auto-saved draft for later instead of silently losing
 * it. Modelled on `PhotoSourceSheet` rather than `BottomSheet`: the creation
 * flow already wraps itself in one `BottomSheet`, which can't nest (see
 * `PhotoSourceSheet`'s docblock). */
export function CancelDraftSheet({
  onKeep,
  onDiscard,
  onDismiss,
}: {
  onKeep: () => void
  onDiscard: () => void
  /** Backdrop click / Escape: closes the sheet only, same as `PhotoSourceSheet`'s
   * `onCancel` — distinct from `onKeep`, which also navigates away. A stray tap
   * dismissing this sheet must land the user back on the form, not on the map. */
  onDismiss: () => void
}) {
  return (
    <Modal
      ariaLabel={fr.newKlash.draft.cancelTitle}
      onClose={onDismiss}
      contentClassName="flex flex-col gap-2 p-4"
    >
      <h2 className="text-center text-sm font-medium text-neutral-700">
        {fr.newKlash.draft.cancelTitle}
      </h2>
      <p className="text-center text-sm text-neutral-600">{fr.newKlash.draft.cancelBody}</p>
      <button
        type="button"
        onClick={onKeep}
        className="mt-1 inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        {fr.newKlash.draft.cancelKeep}
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        {fr.newKlash.draft.cancelDiscard}
      </button>
    </Modal>
  )
}
