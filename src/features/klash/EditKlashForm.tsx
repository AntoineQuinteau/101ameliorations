import { useEffect, useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { fr } from '../../i18n/fr'
import type { Klash } from '../../types/klash'
import { KlashFieldset } from '../newKlash/KlashFieldset'
import {
  klashFormDraftFromKlash,
  messageForKlashFormIssue,
  newKlashFormSchema,
  type KlashFormDraft,
  type NewKlashForm,
} from '../newKlash/newKlashSchemas'
import { createSubmitGuard } from '../newKlash/submitGuard'
import { KlashPhotoEditor } from './KlashPhotoEditor'

/** The klash edit form (spec §6.3 "Modifier" — author while `new`, or
 * moderator/admin; KlashDetailPage gates rendering this on
 * `canEditKlash`). Presentational, like ChangeStatusForm: the parent owns
 * the mutation and passes `isSubmitting`/`submitErrorMessage`/`onSubmit`.
 *
 * Deliberately NOT a reuse of KlashFormStep, despite editing the same six
 * fields:
 * - KlashFormStep carries the EXIF-GPS-moves-the-pin flow (pinLat/pinLng/
 *   onUsePhotoPosition) for a position field this form doesn't have.
 * - Its photos are staged PendingPhoto[] with object-URL lifecycle
 *   management, owned by the parent so they survive the duplicates step;
 *   here the klash already exists, so photos are server-side rows managed
 *   by KlashPhotoEditor's own mutations instead (see its docblock).
 * - Its `hasSubmitted` disables the submit button permanently, correct for
 *   a create that must happen exactly once (submitGuard.ts) but wrong for
 *   an edit that should be retryable after a failed save.
 *
 * The two forms share what actually is shared: KlashFieldset, the zod
 * schema, the issue-to-message mapping, and the double-submit guard. */
export function EditKlashForm({
  klash,
  isSubmitting,
  submitErrorMessage,
  onSubmit,
  onCancel,
}: {
  klash: Klash
  isSubmitting: boolean
  submitErrorMessage: string | null
  onSubmit: (form: NewKlashForm) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState<KlashFormDraft>(() => klashFormDraftFromKlash(klash))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [guard] = useState(createSubmitGuard)

  // Unlike the creation form (whose guard stays claimed once submitted —
  // create_klash has no natural key, so a resubmit would insert twice), an
  // edit's UPDATE is idempotent and the form stays on screen after a
  // failure: release the guard whenever the parent reports one, so the
  // user can fix whatever went wrong and try again.
  useEffect(() => {
    if (submitErrorMessage) guard.release()
  }, [submitErrorMessage, guard])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!guard.claim()) return

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
      guard.release() // invalid — let the user fix it and resubmit
      return
    }
    setValidationError(null)
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-neutral-900">{fr.detail.edit.title}</h1>

      <KlashFieldset value={value} onChange={setValue} idPrefix="edit-klash" />

      <KlashPhotoEditor klashId={klash.id} />

      {(validationError ?? submitErrorMessage) && (
        <ErrorMessage message={validationError ?? submitErrorMessage ?? ''} />
      )}

      <div className="flex gap-2">
        {/* Disabled while submitting, not just the submit button: closing
            this form mid-save lets the parent reopen a fresh EditKlashForm
            before the original mutate() call resolves. updateMutation.reset()
            on reopen clears the mutation's *state* but does not abort the
            still-in-flight request or its per-call onSuccess — when that
            fires, it would close the just-reopened form and discard
            whatever the user had retyped. Keeping Cancel disabled until the
            mutation settles makes that reopen-while-pending sequence
            unreachable. */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {fr.detail.edit.cancel}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="flex-1 inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? fr.detail.edit.submitting : fr.detail.edit.submit}
        </button>
      </div>
    </form>
  )
}
