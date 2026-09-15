import { useState } from 'react'
import { fr } from '../../i18n/fr'
import type { KlashStatus } from '../../types/klash'
import { createSubmitGuard } from '../newKlash/submitGuard'
import { statusNoteSchema } from './statusChangeSchemas'

/** Inline "Changer le statut" form (spec §6.3): a select restricted to
 * `options` (the caller already filtered these to what the signed-in role
 * may do — see allowedNextStatuses in src/lib/klashTransitions.ts) plus an
 * optional note. Same shape and double-submit guard as CommentForm. */
export function ChangeStatusForm({
  options,
  isSubmitting,
  submitErrorMessage,
  onSubmit,
  onCancel,
}: {
  options: KlashStatus[]
  isSubmitting: boolean
  submitErrorMessage: string | null
  onSubmit: (toStatus: KlashStatus, note: string | null) => void
  onCancel: () => void
}) {
  const [toStatus, setToStatus] = useState<KlashStatus>(options[0])
  const [note, setNote] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [guard] = useState(createSubmitGuard)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!guard.claim()) return

    const result = statusNoteSchema.safeParse(note)
    if (!result.success) {
      setValidationError(fr.detail.lifecycle.invalidNote)
      guard.release()
      return
    }
    setValidationError(null)
    onSubmit(toStatus, result.data.length > 0 ? result.data : null)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3"
    >
      <h3 className="text-sm font-semibold text-neutral-900">
        {fr.detail.lifecycle.changeStatusTitle}
      </h3>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {fr.detail.lifecycle.newStatusLabel}
        <select
          value={toStatus}
          onChange={(event) => setToStatus(event.target.value as KlashStatus)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        >
          {options.map((status) => (
            <option key={status} value={status}>
              {fr.status[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {fr.detail.lifecycle.noteLabel}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onFocus={() => guard.release()}
          placeholder={fr.detail.lifecycle.notePlaceholder}
          rows={2}
          maxLength={500}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
        />
      </label>

      {(validationError ?? submitErrorMessage) && (
        <p role="alert" className="text-sm text-red-700">
          {validationError ?? submitErrorMessage}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {isSubmitting ? fr.detail.lifecycle.submitting : fr.detail.lifecycle.submit}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.detail.lifecycle.cancel}
        </button>
      </div>
    </form>
  )
}
