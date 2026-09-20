import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fr } from '../../i18n/fr'
import { CodeStep } from './CodeStep'
import { EmailStep } from './EmailStep'
import { NicknameStep } from './NicknameStep'
import { safeNextPath } from './safeNextPath'
import { useAuth } from './useAuth'
import { useOtpLogin } from './useOtpLogin'
import { useProfile } from './useProfile'

/** Email -> 6-digit code -> optional pseudo, in one page (spec §6.4). Kept as
 * a single route rather than a separate "welcome" screen so `?next=` is
 * honoured exactly once, at the very end — important once step 4 sends users
 * here mid-report via `/login?next=/new`. The machine itself lives in
 * useOtpLogin, shared with SubmitStep's inline reproduction of this flow. */
export function LoginPage() {
  const { user, isInitializing } = useAuth()
  const { data: profile } = useProfile()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = safeNextPath(searchParams.get('next'))

  const login = useOtpLogin()

  // Already signed in: skip straight past what's already done. A user with
  // no pseudo who hasn't dismissed the prompt still sees it (unless they hit
  // /login directly with an unrelated `next`, in which case we don't nag —
  // the prompt is for the fresh-login moment, not every visit to /login).
  useEffect(() => {
    if (isInitializing || !user) return
    if (login.step !== 'email') return
    navigate(nextPath, { replace: true })
  }, [isInitializing, user, login.step, nextPath, navigate])

  // Once verifyOtp succeeds, `user` becomes non-null and `profile` loads.
  // Decide here (rather than inside submitCode) so it reacts once the
  // profile query actually resolves.
  useEffect(() => {
    if (login.step !== 'code') return
    if (!user) return
    if (!profile) return // still loading
    login.setIsSubmitting(false)
    if (login.shouldPromptForPseudo(profile.displayName, login.hasSkippedPseudoPrompt())) {
      login.setStep('nickname')
    } else {
      navigate(nextPath, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [login.step, user, profile, nextPath, navigate])

  async function handleNicknameSubmit(displayName: string) {
    try {
      await login.submitNickname(displayName)
    } finally {
      navigate(nextPath, { replace: true })
    }
  }

  function handleNicknameSkip() {
    login.skipNickname()
    navigate(nextPath, { replace: true })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-neutral-900">{fr.login.title}</h1>

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

      {login.step === 'nickname' && (
        <NicknameStep
          isSubmitting={login.isNicknameSubmitting}
          onSubmit={(displayName) => void handleNicknameSubmit(displayName)}
          onSkip={handleNicknameSkip}
        />
      )}
    </div>
  )
}
