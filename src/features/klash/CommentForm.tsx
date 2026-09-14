import { useState } from 'react'
import { fr } from '../../i18n/fr'
import { commentBodySchema } from './commentSchemas'
import { createSubmitGuard } from '../newKlash/submitGuard'

/** Posting form, or an initial value + save/cancel pair for inline editing
 * of an existing comment (see CommentList). Shares the guard-against-
 * double-submit idiom used by NewKlashPage's forms. */
export function CommentForm({
  initialValue = '',
  submitLabel,
  submittingLabel,
  isSubmitting,
  submitErrorMessage,
  onSubmit,
  onCancel,
}: {
  initialValue?: string
  submitLabel: string
  submittingLabel: string
  isSubmitting: boolean
  submitErrorMessage: string | null
  onSubmit: (body: string) => void
  onCancel?: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [guard] = useState(createSubmitGuard)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!guard.claim()) return

    const result = commentBodySchema.safeParse(value)
    if (!result.success) {
      setValidationError(fr.comments.invalidBody)
      guard.release()
      return
    }
    setValidationError(null)
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => guard.release()}
        placeholder={fr.comments.placeholder}
        rows={3}
        maxLength={1000}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
      />
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
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {fr.comments.cancel}
          </button>
        )}
      </div>
    </form>
  )
}
