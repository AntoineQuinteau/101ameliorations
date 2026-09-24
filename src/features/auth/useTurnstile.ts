import { useCallback, useEffect, useRef, useState } from 'react'
import { env } from '../../env'
import { loadTurnstile, requestTurnstileToken, type TurnstileResult } from '../../lib/turnstile'

/**
 * How long to wait for Turnstile to hand back a token before giving up.
 *
 * Turnstile signals success, failure and expiry through callbacks, but it
 * has no callback for "this visitor will never finish" — an interactive
 * challenge nobody completes simply sits there. Without this ceiling
 * `getToken()` never settles, `submitEmail()` never reaches
 * `signInWithOtp`, and the button stays on "Envoi en cours…" forever.
 *
 * Generous on purpose: it is a stuck-state backstop, not a patience budget.
 * A visitor genuinely solving a checkbox challenge must not trip it.
 */
const TOKEN_TIMEOUT_MS = 30_000

/**
 * Owns one invisible Turnstile widget and exposes `getToken()`, which
 * executes it and resolves with a fresh token — or with the reason there is
 * none (see `TurnstileResult`), so a failure can be diagnosed instead of
 * collapsing into a bare "captcha failed".
 *
 * A Turnstile token is single-use and expires after 300 s, so every
 * `getToken()` call renders a fresh widget: the OTP resend button is a
 * second, independent send and cannot reuse the first token.
 *
 * `containerRef` must be attached to a real, visible-capable element in the
 * form (see `TurnstileSlot`): when Cloudflare decides this visitor needs an
 * interactive challenge, the widget has to be somewhere the user can
 * actually see and click. The element stays visually empty until
 * `isInteractive` turns true.
 *
 * Resolves `{ ok: false, reason: 'no-site-key' }` when
 * `VITE_TURNSTILE_SITE_KEY` isn't set (see src/env.ts).
 */
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [isInteractive, setIsInteractive] = useState(false)

  // Warm the script up front rather than on click: loading it is the
  // slowest part of the send. A failure here is deliberately swallowed —
  // getToken() retries (loadTurnstile clears its own promise on rejection)
  // and owns the user-visible error.
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

  const getToken = useCallback((): Promise<TurnstileResult> => {
    const siteKey = env.VITE_TURNSTILE_SITE_KEY
    if (!siteKey) return Promise.resolve({ ok: false, reason: 'no-site-key' })

    return loadTurnstile().then(
      (turnstile): Promise<TurnstileResult> => {
        const container = containerRef.current
        if (!container) return Promise.resolve({ ok: false, reason: 'no-container' })
        return requestTurnstileToken(turnstile, container, {
          siteKey,
          previousWidgetId: widgetIdRef.current,
          onRendered: (widgetId) => {
            widgetIdRef.current = widgetId
          },
          onInteractiveChange: setIsInteractive,
          timeoutMs: TOKEN_TIMEOUT_MS,
        })
      },
      // The script never loaded (blocked, offline, timed out).
      (): TurnstileResult => {
        setIsInteractive(false)
        return { ok: false, reason: 'script-unavailable' }
      },
    )
  }, [])

  return { getToken, containerRef, isInteractive }
}
