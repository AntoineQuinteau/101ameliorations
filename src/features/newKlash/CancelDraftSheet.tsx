import { useEffect } from 'react'
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
}: {
  onKeep: () => void
  onDiscard: () => void
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onKeep()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onKeep])

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onKeep}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={fr.newKlash.draft.cancelTitle}
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-2 rounded-xl bg-white p-4 shadow-lg"
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
      </div>
    </div>
  )
}
