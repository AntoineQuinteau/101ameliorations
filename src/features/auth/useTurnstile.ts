import { useCallback, useEffect, useRef, useState } from 'react'
import { env } from '../../env'
import { loadTurnstile } from '../../lib/turnstile'

/**
 * How long to wait for Turnstile to hand back a token before giving up.
 *
 * Turnstile signals success, failure and expiry through callbacks, but it
 * has no callback for "this visitor will never finish" — an interactive
 * challenge nobody completes simply sits there. Without this ceiling
 * `getToken()` never settles, `submitEmail()` never reaches
 * `signInWithOtp`, and the button stays on "Envoi en cours…" forever with
 * no email sent and no error shown. Resolving `undefined` instead lets the
 * caller surface `fr.login.errors.captcha` and re-enable the form.
 *
 * Generous on purpose: it is a stuck-state backstop, not a patience budget.
 * A visitor genuinely solving a checkbox challenge must not trip it.
 */
const TOKEN_TIMEOUT_MS = 30_000

/**
 * Owns one invisible Turnstile widget and exposes `getToken()`, which
 * executes it and resolves with a fresh token.
 *
 * A Turnstile token is single-use and expires after 300 s (verified against
 * Cloudflare's docs), so the widget is reset immediately after every
 * execution — the next `getToken()` call always mints a new challenge rather
 * than replaying a spent one. This matters here specifically because the
 * OTP resend button is a second, independent send: it cannot reuse the
 * token from the first one.
 *
 * `containerRef` must be attached to a real, visible-capable element in the
 * form (see `EmailStep`/`CodeStep`): when Cloudflare decides this visitor
 * needs an interactive challenge, the widget has to be somewhere the user
 * can actually see and click. It previously rendered into a detached
 * `display: none` div, which silently locked out every visitor Cloudflare
 * wanted to challenge — CGNAT mobile IPs, VPNs, private windows. The
 * element stays visually empty until `isInteractive` turns true, so the
 * common invisible path looks exactly as before.
 *
 * Returns `undefined` when `VITE_TURNSTILE_SITE_KEY` isn't set, so the app
 * behaves exactly as it did before this widget existed until the human adds
 * the key (see src/env.ts).
 */
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [isInteractive, setIsInteractive] = useState(false)

  // Warm the script up front rather than on click. Loading it is the
  // slowest part of the whole send, and paying for it while the user is
  // still typing their email makes the click itself cost little more than
  // one `execute()`. A failure here is deliberately swallowed: getToken()
  // retries (loadTurnstile clears its own promise on rejection) and owns
  // the user-visible error.
  useEffect(() => {
    if (!env.VITE_TURNSTILE_SITE_KEY) return
    void loadTurnstile().catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      const turnstile = window.turnstile
      if (turnstile && widgetIdRef.current) turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [])

  const getToken = useCallback((): Promise<string | undefined> => {
    if (!env.VITE_TURNSTILE_SITE_KEY) return Promise.resolve(undefined)

    return loadTurnstile()
      .then(
        (turnstile) =>
          new Promise<string | undefined>((resolve) => {
            const container = containerRef.current
            if (!container) {
              resolve(undefined)
              return
            }

            let settled = false
            // Every exit runs through here, so the widget is always torn
            // down and the challenge slot always hidden again — including
            // on the timeout path, where Turnstile itself never calls back.
            const settle = (token: string | undefined) => {
              if (settled) return
              settled = true
              clearTimeout(timeoutId)
              setIsInteractive(false)
              resolve(token)
            }
            const timeoutId = setTimeout(() => settle(undefined), TOKEN_TIMEOUT_MS)

            // Remove any prior widget bound to an earlier call's own
            // callback/error-callback (or none, on first use) before
            // rendering a fresh one for this specific call — a Turnstile
            // token is single-use, so every getToken() gets its own
            // challenge rather than replaying a spent one.
            if (widgetIdRef.current) turnstile.remove(widgetIdRef.current)
            widgetIdRef.current = turnstile.render(container, {
              sitekey: env.VITE_TURNSTILE_SITE_KEY!,
              appearance: 'interaction-only',
              execution: 'execute',
              callback: (token) => settle(token),
              'error-callback': () => settle(undefined),
              // Fired when a token goes stale before it was spent, and when
              // the challenge itself times out. Both were previously
              // unhandled, leaving the promise pending for good.
              'expired-callback': () => settle(undefined),
              'timeout-callback': () => settle(undefined),
              // Cloudflare is about to show a checkbox: give the widget
              // real estate in the form so the user can complete it.
              'before-interactive-callback': () => setIsInteractive(true),
            })
            turnstile.execute(container)
          }),
      )
      .catch(() => {
        // The script never loaded (blocked, offline, timed out). Same
        // contract as a failed challenge: no token, caller shows the
        // captcha error rather than hanging.
        setIsInteractive(false)
        return undefined
      })
  }, [])

  return { getToken, containerRef, isInteractive }
}
