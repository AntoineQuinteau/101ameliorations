import { useState } from 'react'
import { ErrorMessage } from '../../components/ErrorMessage'
import { fr } from '../../i18n/fr'
import { otpCodeSchema, sanitizeOtpInput } from './authSchemas'

export function CodeStep({
  email,
  isSubmitting,
  errorMessage,
  resendSecondsLeft,
  onSubmit,
  onResend,
  onChangeEmail,
}: {
  email: string
  isSubmitting: boolean
  errorMessage: string | null
  resendSecondsLeft: number
  onSubmit: (code: string) => void
  onResend: () => void
  onChangeEmail: () => void
}) {
  const [code, setCode] = useState('')
  const [validationError, setValidationError] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const result = otpCodeSchema.safeParse(code)
    if (!result.success) {
      setValidationError(true)
      return
    }
    setValidationError(false)
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-neutral-700">{fr.login.codeStep.instructions(email)}</p>

      <label htmlFor="login-code" className="text-sm font-medium text-neutral-700">
        {fr.login.codeStep.label}
      </label>
      <input
        id="login-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(sanitizeOtpInput(event.target.value))}
        className="rounded-md border border-neutral-300 px-3 py-2 text-center text-lg tracking-[0.5em] focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
      />
      {validationError && (
        <p role="alert" className="text-sm text-red-700">
          {fr.login.errors.invalidOrExpiredCode}
        </p>
      )}
      {errorMessage && <ErrorMessage message={errorMessage} />}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {isSubmitting ? fr.login.codeStep.submitting : fr.login.codeStep.submit}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onChangeEmail}
          className="font-medium text-teal-700 hover:underline"
        >
          {fr.login.codeStep.changeEmail}
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={resendSecondsLeft > 0}
          className="font-medium text-teal-700 hover:underline disabled:text-neutral-400 disabled:no-underline"
        >
          {resendSecondsLeft > 0
            ? fr.login.codeStep.resendCooldown(resendSecondsLeft)
            : fr.login.codeStep.resend}
        </button>
      </div>
    </form>
  )
}
