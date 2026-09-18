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

    let cancelled = false
    void loadTurnstile().then((turnstile) => {
      if (cancelled) return
      widgetIdRef.current = turnstile.render(container, {
        sitekey: env.VITE_TURNSTILE_SITE_KEY!,
        appearance: 'interaction-only',
        execution: 'execute',
        callback: () => {
          // Resolved via the getToken() promise below, not here — this
          // callback only fires the widget's own internal state forward.
        },
      })
    })

    return () => {
      cancelled = true
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
          const widgetId = widgetIdRef.current
          if (!container || !widgetId) {
            resolve(undefined)
            return
          }

          // Re-render bound to this call's own callback/error-callback so
          // getToken() can resolve/reject a specific invocation, then reset
          // so the next call starts a fresh challenge rather than replaying
          // this (now spent) token.
          turnstile.remove(widgetId)
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
