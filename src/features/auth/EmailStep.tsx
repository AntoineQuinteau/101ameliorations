import { useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ErrorMessage } from '../../components/ErrorMessage'
import { fr } from '../../i18n/fr'
import { emailSchema } from './authSchemas'
import { readLoginEmailDraft, writeLoginEmailDraft } from './loginEmailDraft'
import { TurnstileSlot } from './TurnstileSlot'

export function EmailStep({
  isSubmitting,
  errorMessage,
  turnstileContainerRef,
  isTurnstileInteractive,
  onSubmit,
}: {
  isSubmitting: boolean
  errorMessage: string | null
  turnstileContainerRef: RefObject<HTMLDivElement | null>
  isTurnstileInteractive: boolean
  onSubmit: (email: string) => void
}) {
  // Restored from sessionStorage so a round trip to the privacy policy keeps the
  // typed address (cleared by useOtpLogin once signed in).
  const [email, setEmail] = useState(readLoginEmailDraft)
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
        onChange={(event) => {
          setEmail(event.target.value)
          writeLoginEmailDraft(event.target.value)
        }}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
      />
      {validationError && (
        <p role="alert" className="text-sm text-red-700">
          {fr.login.errors.invalidEmail}
        </p>
      )}
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <TurnstileSlot containerRef={turnstileContainerRef} isInteractive={isTurnstileInteractive} />
      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {isSubmitting ? fr.login.emailStep.submitting : fr.login.emailStep.submit}
      </button>
      {/* Same tab, like every other in-app link: a new tab leaves the
          installed PWA. The typed email survives the round trip (sessionStorage,
          see loginEmailDraft.ts), and a report being written on /new is
          autosaved as a draft. */}
      <Link
        to="/confidentialite"
        className="text-center text-xs text-neutral-500 underline hover:text-neutral-700"
      >
        {fr.login.emailStep.privacyLink}
      </Link>
    </form>
  )
}
