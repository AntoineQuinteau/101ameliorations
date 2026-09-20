import { useEffect, useState } from 'react'
import { CodeStep } from '../auth/CodeStep'
import { EmailStep } from '../auth/EmailStep'
import { NicknameStep } from '../auth/NicknameStep'
import { useAuth } from '../auth/useAuth'
import { useOtpLogin } from '../auth/useOtpLogin'
import { useProfile } from '../auth/useProfile'
import { fr } from '../../i18n/fr'
import { Spinner } from '../../components/Spinner'
import { ErrorMessage } from '../../components/ErrorMessage'

/**
 * Final step of the creation sheet: inline login (if signed out) then runs
 * `onReady`. Reproduces `LoginPage`'s email -> code -> nickname machine via
 * the shared `useOtpLogin` hook instead of navigating to `/login`, so the
 * draft (position, category, title, description — or the "confirm this
 * klash" pending action) never leaves React state and needs no
 * sessionStorage handoff.
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
  const { user, isInitializing } = useAuth()
  const { data: profile } = useProfile()
  const login = useOtpLogin()

  const [hasStartedSubmit, setHasStartedSubmit] = useState(false)

  // Once verifyOtp succeeds, `user` becomes non-null and `profile` loads:
  // decide whether to prompt for a pseudo, same as LoginPage.
  useEffect(() => {
    if (login.step !== 'code') return
    if (!user) return
    if (!profile) return
    login.setIsSubmitting(false)
    if (login.shouldPromptForPseudo(profile.displayName, login.hasSkippedPseudoPrompt())) {
      login.setStep('nickname')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [login.step, user, profile])

  // Signed in, and past the nickname step (if any): run the pending action
  // exactly once.
  useEffect(() => {
    if (isInitializing || !user) return
    if (login.step === 'code' && !profile) return // still resolving after verifyOtp
    if (login.step === 'nickname') return
    if (hasStartedSubmit) return
    setHasStartedSubmit(true)
    onReady()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitializing, user, login.step, profile, hasStartedSubmit])

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

        {login.step === 'email' && (
          <EmailStep
            isSubmitting={login.isSubmitting}
            errorMessage={login.errorMessage}
            turnstileContainerRef={login.turnstileContainerRef}
            isTurnstileInteractive={login.isTurnstileInteractive}
            onSubmit={(email) => void login.submitEmail(email)}
          />
        )}

        {login.step === 'code' && (
          <CodeStep
            email={login.email}
            isSubmitting={login.isSubmitting}
            errorMessage={login.errorMessage}
            resendSecondsLeft={login.resendSecondsLeft}
            turnstileContainerRef={login.turnstileContainerRef}
            isTurnstileInteractive={login.isTurnstileInteractive}
            onSubmit={(code) => void login.submitCode(code)}
            onResend={() => void login.resend()}
            onChangeEmail={login.changeEmail}
          />
        )}
      </div>
    )
  }

  async function handleNicknameSubmit(displayName: string) {
    await login.submitNickname(displayName)
    // Unlike LoginPage, this step never navigates away — it's an inline
    // sheet, not a route — so nothing else ever moves `login.step` off
    // 'nickname' once the user is done with it. Without this, the effect
    // above that fires `onReady()` (line 53: `if (login.step === 'nickname')
    // return`) never releases: the pending klash creation/confirmation
    // silently never runs, and the user is stuck on this step forever.
    login.setStep('code')
  }

  function handleNicknameSkip() {
    login.skipNickname()
    login.setStep('code') // see handleNicknameSubmit's comment above
  }

  return (
    <NicknameStep
      isSubmitting={login.isNicknameSubmitting}
      onSubmit={(displayName) => void handleNicknameSubmit(displayName)}
      onSkip={handleNicknameSkip}
    />
  )
}
