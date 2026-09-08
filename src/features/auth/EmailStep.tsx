import { useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { fr } from '../../i18n/fr'
import { emailSchema } from './authSchemas'

export function EmailStep({
  isSubmitting,
  errorMessage,
  onSubmit,
}: {
  isSubmitting: boolean
  errorMessage: string | null
  onSubmit: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  const [validationError, setValidationError] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const result = emailSchema.safeParse(email)
    if (!result.success) {
      setValidationError(true)
      return
    }
    setValidationError(false)
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="login-email" className="text-sm font-medium text-neutral-700">
        {fr.login.emailStep.label}
      </label>
      <input
        id="login-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={fr.login.emailStep.placeholder}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
      />
      {validationError && (
        <p role="alert" className="text-sm text-red-700">
          {fr.login.errors.invalidEmail}
        </p>
      )}
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {isSubmitting ? fr.login.emailStep.submitting : fr.login.emailStep.submit}
      </button>
    </form>
  )
}
