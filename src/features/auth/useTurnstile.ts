import { useCallback, useEffect, useRef } from 'react'
import { env } from '../../env'
import { loadTurnstile } from '../../lib/turnstile'

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
 * Returns `undefined` when `VITE_TURNSTILE_SITE_KEY` isn't set, so the app
 * behaves exactly as it did before this widget existed until the human adds
 * the key (see src/env.ts).
 */
export function useTurnstile() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!env.VITE_TURNSTILE_SITE_KEY) return
    const container = document.createElement('div')
    container.style.display = 'none'
    document.body.appendChild(container)
    containerRef.current = container

    // No initial render here on purpose: getToken() below renders its own
    // widget lazily, on first use, rather than racing this effect's own
    // `loadTurnstile().then(...)` — both awaited the same script-load
    // promise, so a getToken() call arriving before this one resolved would
    // find widgetIdRef still null and silently return no token (which
    // Supabase then rejects as captcha_failed). getToken() renders on
    // demand instead, so there is exactly one path that sets widgetIdRef.

    return () => {
      const turnstile = window.turnstile
      if (turnstile && widgetIdRef.current) turnstile.remove(widgetIdRef.current)
      container.remove()
    }
  }, [])

  const getToken = useCallback((): Promise<string | undefined> => {
    if (!env.VITE_TURNSTILE_SITE_KEY) return Promise.resolve(undefined)

    return loadTurnstile().then(
      (turnstile) =>
        new Promise<string | undefined>((resolve) => {
          const container = containerRef.current
          if (!container) {
            resolve(undefined)
            return
          }

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
            callback: (token) => {
              resolve(token)
            },
            'error-callback': () => {
              resolve(undefined)
            },
          })
          turnstile.execute(container)
        }),
    )
  }, [])

  return { getToken }
}
