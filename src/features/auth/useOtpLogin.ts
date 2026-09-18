import { useState } from 'react'
import { fr } from '../../i18n/fr'
import { authErrorMessageKey } from './authErrors'
import { pseudoPromptStorageKey, shouldPromptForPseudo } from './nicknamePrompt'
import { useAuth } from './useAuth'
import { useResendCooldown } from './useResendCooldown'
import { useTurnstile } from './useTurnstile'
import { useUpdateDisplayName } from './useUpdateDisplayName'

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

  async function submitEmail(submittedEmail: string) {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const captchaToken = await turnstile.getToken()
      await signInWithOtp(submittedEmail, captchaToken)
      setEmail(submittedEmail)
      setStep('code')
      resendCooldown.start()
    } catch (error) {
      setErrorMessage(fr.login.errors[authErrorMessageKey(error)])
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resend() {
    setErrorMessage(null)
    try {
      const captchaToken = await turnstile.getToken()
      await signInWithOtp(email, captchaToken)
      resendCooldown.start()
    } catch (error) {
      setErrorMessage(fr.login.errors[authErrorMessageKey(error)])
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
