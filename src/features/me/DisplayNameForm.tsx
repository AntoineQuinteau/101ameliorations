import { useState } from 'react'
import { displayNameSchema } from '../auth/authSchemas'
import { fr } from '../../i18n/fr'

/** Pseudo-editing form shared by the first-login prompt (`NicknameStep`) and
 * `/me`. `submitLabel` lets each caller phrase the button differently
 * ("Enregistrer" in both, but kept as a prop for future divergence). */
export function DisplayNameForm({
  initialValue,
  submitLabel,
  isSubmitting,
  onSubmit,
}: {
  initialValue: string
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (displayName: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const result = displayNameSchema.safeParse(value)
    if (!result.success) {
      setError(fr.login.nicknameStep.invalidLength)
      return
    }
    setError(null)
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label htmlFor="display-name" className="text-sm font-medium text-neutral-700">
        {fr.login.nicknameStep.label}
      </label>
      <input
        id="display-name"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        minLength={2}
        maxLength={40}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  )
}
