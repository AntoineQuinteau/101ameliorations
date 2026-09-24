import { useState } from 'react'
import { fr } from '../../i18n/fr'
import { authErrorMessageKey } from './authErrors'
import { captchaFailureRef, reportCaptchaFailure } from './captchaDiagnostics'
import { pseudoPromptStorageKey, shouldPromptForPseudo } from './nicknamePrompt'
import { useAuth } from './useAuth'
import { useResendCooldown } from './useResendCooldown'
import { useTurnstile } from './useTurnstile'
import { useUpdateDisplayName } from './useUpdateDisplayName'
import type { TurnstileResult } from '../../lib/turnstile'

export type OtpLoginStep = 'email' | 'code' | 'nickname'

/**
 * The email -> code -> optional pseudo machine shared by `LoginPage` (a
 * dedicated route) and `SubmitStep` (the same flow reproduced inline inside
 * the creation sheet, spec §6.2 step 4, so a draft klash never leaves React
 * state). Extracted here so Turnstile only has to be wired once: every send
 * and every resend goes through `useTurnstile().getToken()` first, and a
 * Turnstile token is single-use — the resend button cannot reuse the token
 * minted for the first send, which is exactly what routing both through one
 * hook, and one widget, guarantees.
 *
 * Deliberately does *not* own navigation or "what happens once logged in":
 * `LoginPage` and `SubmitStep` differ there (redirect to `?next=` vs.
 * running a pending action), so the hook exposes `step`/`user`/`profile`
 * and lets each caller layer its own effect on top, same as before this
 * extraction.
 */
export function useOtpLogin() {
  const { user, signInWithOtp, verifyOtp } = useAuth()
  const updateDisplayName = useUpdateDisplayName()
  const resendCooldown = useResendCooldown()
  const turnstile = useTurnstile()

  const [step, setStep] = useState<OtpLoginStep>('email')
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function hasSkippedPseudoPrompt(): boolean {
    try {
      return user ? localStorage.getItem(pseudoPromptStorageKey(user.id)) !== null : false
    } catch {
      return false
    }
  }

  function markPseudoPromptSkipped() {
    try {
      if (user) localStorage.setItem(pseudoPromptStorageKey(user.id), '1')
    } catch {
      // Private mode / storage blocked: nothing to persist, and nothing to
      // do about it — the prompt may just reappear next time.
    }
  }

  /** Requests a Turnstile token, then the OTP email. A missing token is
   * still sent (as `undefined`): if Supabase's captcha protection is off,
   * the send succeeds anyway, which keeps that dashboard toggle usable as a
   * kill switch whenever Turnstile itself is broken. */
  async function sendOtp(targetEmail: string) {
    const turnstileResult = await turnstile.getToken()
    try {
      await signInWithOtp(targetEmail, turnstileResult.ok ? turnstileResult.token : undefined)
    } catch (error) {
      throw new OtpSendError(error, turnstileResult)
    }
  }

  function sendErrorMessage(error: unknown): string {
    const cause = error instanceof OtpSendError ? error.cause : error
    const key = authErrorMessageKey(cause)
    if (key !== 'captcha' || !(error instanceof OtpSendError)) return fr.login.errors[key]
    reportCaptchaFailure(error.turnstileResult, cause)
    const ref = captchaFailureRef(error.turnstileResult, cause)
    return `${fr.login.errors.captcha} ${fr.login.turnstile.reference(ref)}`
  }

  async function submitEmail(submittedEmail: string) {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await sendOtp(submittedEmail)
      setEmail(submittedEmail)
      setStep('code')
      resendCooldown.start()
    } catch (error) {
      setErrorMessage(sendErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resend() {
    setErrorMessage(null)
    try {
      await sendOtp(email)
      resendCooldown.start()
    } catch (error) {
      setErrorMessage(sendErrorMessage(error))
      resendCooldown.start()
    }
  }

  async function submitCode(code: string) {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await verifyOtp(email, code)
      // isSubmitting is cleared by the caller once `profile` resolves, not
      // here — see LoginPage/SubmitStep's own effect for why.
    } catch (error) {
      setErrorMessage(fr.login.errors[authErrorMessageKey(error)])
      setIsSubmitting(false)
    }
  }

  function changeEmail() {
    setStep('email')
    setErrorMessage(null)
  }

  async function submitNickname(displayName: string) {
    await updateDisplayName.mutateAsync(displayName)
  }

  function skipNickname() {
    markPseudoPromptSkipped()
  }

  return {
    step,
    setStep,
    email,
    isSubmitting,
    setIsSubmitting,
    errorMessage,
    resendSecondsLeft: resendCooldown.secondsLeft,
    turnstileContainerRef: turnstile.containerRef,
    isTurnstileInteractive: turnstile.isInteractive,
    submitEmail,
    resend,
    submitCode,
    changeEmail,
    submitNickname,
    skipNickname,
    isNicknameSubmitting: updateDisplayName.isPending,
    hasSkippedPseudoPrompt,
    shouldPromptForPseudo,
  }
}

/** Carries the Turnstile outcome alongside the Supabase error, so a
 * `captcha_failed` can be traced back to what happened client-side. */
class OtpSendError extends Error {
  constructor(
    readonly cause: unknown,
    readonly turnstileResult: TurnstileResult,
  ) {
    super('signInWithOtp failed')
  }
}
