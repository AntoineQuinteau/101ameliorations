import { fr } from '../../i18n/fr'
import { formatDateTime } from '../../utils/formatDate'

/** Shown instead of `PositionStep` when the report flow opens with an
 * explicit `?lat=&lng=` (a map tap or "Signaler où je suis") while a draft
 * from an earlier visit is still saved — the incoming position and the
 * draft's own position can't both be used, so the user picks which report
 * they mean before either one proceeds. Opening `/new` with no explicit
 * position (the map's "déclaration en cours" chip) skips this screen
 * entirely and restores the draft immediately instead. */
export function DraftResumeStep({
  savedAt,
  onResume,
  onStartNew,
  onCancel,
}: {
  savedAt: string
  onResume: () => void
  onStartNew: () => void
  /** Like the other three steps' onCancel — needed here too: in the
   * installed PWA there's no browser chrome to fall back on, and
   * "Commencer une nouvelle déclaration ici" is destructive (it purges the
   * saved draft immediately), so a user who reached this screen by mistake
   * needs a third, non-committing way out. */
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-neutral-900">{fr.newKlash.draft.resumeTitle}</h2>
      <p className="text-sm text-neutral-600">
        {fr.newKlash.draft.resumeBody(formatDateTime(savedAt))}
      </p>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onResume}
          className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {fr.newKlash.draft.resumeAction}
        </button>
        <button
          type="button"
          onClick={onStartNew}
          className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.newKlash.draft.startNewAction}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-neutral-500 hover:text-neutral-700"
        >
          {fr.newKlash.cancel}
        </button>
      </div>
    </div>
  )
}
