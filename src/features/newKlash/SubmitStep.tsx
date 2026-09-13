import { useEffect, useState } from 'react'
import { CodeStep } from '../auth/CodeStep'
import { EmailStep } from '../auth/EmailStep'
import { authErrorMessageKey } from '../auth/authErrors'
import { NicknameStep } from '../auth/NicknameStep'
import { pseudoPromptStorageKey, shouldPromptForPseudo } from '../auth/nicknamePrompt'
import { useAuth } from '../auth/useAuth'
import { useProfile } from '../auth/useProfile'
import { useResendCooldown } from '../auth/useResendCooldown'
import { useUpdateDisplayName } from '../auth/useUpdateDisplayName'
import { fr } from '../../i18n/fr'
import { Spinner } from '../../components/Spinner'
import { ErrorMessage } from '../../components/ErrorMessage'

type LoginStep = 'email' | 'code' | 'nickname'

/**
 * Final step of the creation sheet: inline login (if signed out) then runs
 * `onReady`. Reproduces `LoginPage`'s email -> code -> nickname machine
 * locally instead of navigating to `/login`, so the draft (position,
 * category, title, description — or the "confirm this klash" pending
 * action) never leaves React state and needs no sessionStorage handoff.
 */
export function SubmitStep({
  isPending,
  errorMessage,
  onReady,
}: {
  isPending: boolean
  errorMessage: string | null
  onReady: () => void
}) {
  const { user, isInitializing, signInWithOtp, verifyOtp } = useAuth()
  const { data: profile } = useProfile()
  const updateDisplayName = useUpdateDisplayName()
  const resendCooldown = useResendCooldown()

  const [step, setStep] = useState<LoginStep>('email')
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [hasStartedSubmit, setHasStartedSubmit] = useState(false)

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
      // Private mode / storage blocked — nothing to persist.
    }
  }

  async function handleEmailSubmit(submittedEmail: string) {
    setIsSubmitting(true)
    setAuthError(null)
    try {
      await signInWithOtp(submittedEmail)
      setEmail(submittedEmail)
      setStep('code')
      resendCooldown.start()
    } catch (error) {
      setAuthError(fr.login.errors[authErrorMessageKey(error)])
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend() {
    setAuthError(null)
    try {
      await signInWithOtp(email)
      resendCooldown.start()
    } catch (error) {
      setAuthError(fr.login.errors[authErrorMessageKey(error)])
      resendCooldown.start()
    }
  }

  async function handleCodeSubmit(code: string) {
    setIsSubmitting(true)
    setAuthError(null)
    try {
      await verifyOtp(email, code)
    } catch (error) {
      setAuthError(fr.login.errors[authErrorMessageKey(error)])
      setIsSubmitting(false)
    }
  }

  // Once verifyOtp succeeds, `user` becomes non-null and `profile` loads:
  // decide whether to prompt for a pseudo, same as LoginPage.
  useEffect(() => {
    if (step !== 'code') return
    if (!user) return
    if (!profile) return
    setIsSubmitting(false)
    if (shouldPromptForPseudo(profile.displayName, hasSkippedPseudoPrompt())) {
      setStep('nickname')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user, profile])

  async function handleNicknameSubmit(displayName: string) {
    await updateDisplayName.mutateAsync(displayName)
  }

  function handleNicknameSkip() {
    markPseudoPromptSkipped()
  }

  // Signed in, and past the nickname step (if any): run the pending action
  // exactly once.
  useEffect(() => {
    if (isInitializing || !user) return
    if (step === 'code' && !profile) return // still resolving after verifyOtp
    if (step === 'nickname') return
    if (hasStartedSubmit) return
    setHasStartedSubmit(true)
    onReady()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitializing, user, step, profile, hasStartedSubmit])

  if (isInitializing) return <Spinner />

  if (user && (isPending || hasStartedSubmit)) {
    return (
      <div className="flex flex-col gap-3">
        <Spinner />
        {errorMessage && <ErrorMessage message={errorMessage} />}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">{fr.newKlash.submit.loginIntro}</p>

        {step === 'email' && (
          <EmailStep
            isSubmitting={isSubmitting}
            errorMessage={authError}
            onSubmit={handleEmailSubmit}
          />
        )}

        {step === 'code' && (
          <CodeStep
            email={email}
            isSubmitting={isSubmitting}
            errorMessage={authError}
            resendSecondsLeft={resendCooldown.secondsLeft}
            onSubmit={handleCodeSubmit}
            onResend={() => void handleResend()}
            onChangeEmail={() => {
              setStep('email')
              setAuthError(null)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <NicknameStep
      isSubmitting={updateDisplayName.isPending}
      onSubmit={(displayName) => void handleNicknameSubmit(displayName)}
      onSkip={handleNicknameSkip}
    />
  )
}
