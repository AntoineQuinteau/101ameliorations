import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fr } from '../../i18n/fr'
import { authErrorMessageKey } from './authErrors'
import { CodeStep } from './CodeStep'
import { EmailStep } from './EmailStep'
import { NicknameStep } from './NicknameStep'
import { pseudoPromptStorageKey, shouldPromptForPseudo } from './nicknamePrompt'
import { safeNextPath } from './safeNextPath'
import { useAuth } from './useAuth'
import { useProfile } from './useProfile'
import { useResendCooldown } from './useResendCooldown'
import { useUpdateDisplayName } from './useUpdateDisplayName'

type Step = 'email' | 'code' | 'nickname'

/** Email -> 6-digit code -> optional pseudo, in one page (spec §6.4). Kept as
 * a single route rather than a separate "welcome" screen so `?next=` is
 * honoured exactly once, at the very end — important once step 4 sends users
 * here mid-report via `/login?next=/new`. */
export function LoginPage() {
  const { user, isInitializing, signInWithOtp, verifyOtp } = useAuth()
  const { data: profile } = useProfile()
  const updateDisplayName = useUpdateDisplayName()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = safeNextPath(searchParams.get('next'))
  const resendCooldown = useResendCooldown()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Already signed in: skip straight past what's already done. A user with
  // no pseudo who hasn't dismissed the prompt still sees it (unless they hit
  // /login directly with an unrelated `next`, in which case we don't nag —
  // the prompt is for the fresh-login moment, not every visit to /login).
  useEffect(() => {
    if (isInitializing || !user) return
    if (step !== 'email') return
    navigate(nextPath, { replace: true })
  }, [isInitializing, user, step, nextPath, navigate])

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
      // Private mode / storage blocked: nothing to persist, and nothing to do
      // about it — the prompt may just reappear next time.
    }
  }

  async function handleEmailSubmit(submittedEmail: string) {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await signInWithOtp(submittedEmail)
      setEmail(submittedEmail)
      setStep('code')
      resendCooldown.start()
    } catch (error) {
      setErrorMessage(fr.login.errors[authErrorMessageKey(error)])
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResend() {
    setErrorMessage(null)
    try {
      await signInWithOtp(email)
      resendCooldown.start()
    } catch (error) {
      setErrorMessage(fr.login.errors[authErrorMessageKey(error)])
      resendCooldown.start()
    }
  }

  async function handleCodeSubmit(code: string) {
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await verifyOtp(email, code)
      // `profile` isn't refetched synchronously here — it lags one render
      // behind the session update, which is fine: the nickname step is only
      // ever skipped by mistake for one frame, and the effect below re-runs
      // once the profile query resolves.
    } catch (error) {
      setErrorMessage(fr.login.errors[authErrorMessageKey(error)])
      setIsSubmitting(false)
    }
  }

  // Once verifyOtp succeeds, `user` becomes non-null and `profile` loads.
  // Decide here (rather than inside handleCodeSubmit) so it reacts once the
  // profile query actually resolves.
  useEffect(() => {
    if (step !== 'code') return
    if (!user) return
    if (!profile) return // still loading
    setIsSubmitting(false)
    if (shouldPromptForPseudo(profile.displayName, hasSkippedPseudoPrompt())) {
      setStep('nickname')
    } else {
      navigate(nextPath, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user, profile, nextPath, navigate])

  async function handleNicknameSubmit(displayName: string) {
    try {
      await updateDisplayName.mutateAsync(displayName)
    } finally {
      navigate(nextPath, { replace: true })
    }
  }

  function handleNicknameSkip() {
    markPseudoPromptSkipped()
    navigate(nextPath, { replace: true })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">{fr.login.title}</h1>

      {step === 'email' && (
        <EmailStep
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          onSubmit={handleEmailSubmit}
        />
      )}

      {step === 'code' && (
        <CodeStep
          email={email}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          resendSecondsLeft={resendCooldown.secondsLeft}
          onSubmit={handleCodeSubmit}
          onResend={() => void handleResend()}
          onChangeEmail={() => {
            setStep('email')
            setErrorMessage(null)
          }}
        />
      )}

      {step === 'nickname' && (
        <NicknameStep
          isSubmitting={updateDisplayName.isPending}
          onSubmit={(displayName) => void handleNicknameSubmit(displayName)}
          onSkip={handleNicknameSkip}
        />
      )}
    </div>
  )
}
