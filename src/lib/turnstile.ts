// Thin wrapper over the Cloudflare Turnstile client script (spec §5, §6.4:
// "Turnstile invisible entre l'email et signInWithOtp"). No React here —
// src/features/auth/useTurnstile.ts owns the widget lifecycle; this module
// only owns loading the script once and typing its global API.
//
// Supabase's captcha protection is a project-level server-side toggle, not a
// per-request option: once enabled in the dashboard, every signInWithOtp
// without a valid token is rejected. VITE_TURNSTILE_SITE_KEY is therefore
// optional at the env layer (see src/env.ts) so a preview build never
// white-screens before the widget exists — callers of this module must
// handle a missing site key themselves.

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/**
 * How long to wait for the Turnstile script before giving up.
 *
 * `script.onerror` only fires on an outright failure (DNS, 404, CSP). A
 * request that *hangs* — a tracker blocker stalling it, a captive portal, a
 * filtering DNS, a slow mobile network — fires neither handler, so without
 * this ceiling `loadTurnstile()` never settles and every caller awaiting it
 * hangs with it. That is the login screen stuck on "Envoi en cours…"
 * forever, because signInWithOtp is never even reached.
 */
const SCRIPT_LOAD_TIMEOUT_MS = 10_000

export interface TurnstileRenderOptions {
  sitekey: string
  callback: (token: string) => void
  /** Receives Cloudflare's error code (e.g. `110200`, "domain not allowed").
   * Returning `true` tells Turnstile the error was handled, so it doesn't
   * also throw it into the console as an uncaught error. */
  'error-callback'?: (errorCode: string) => boolean | void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
  'before-interactive-callback'?: () => void
  appearance?: 'always' | 'execute' | 'interaction-only'
  execution?: 'render' | 'execute'
  size?: 'normal' | 'compact' | 'invisible'
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  execute: (container: HTMLElement | string) => void
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loadPromise: Promise<TurnstileApi> | null = null

/** Loads the Turnstile script at most once per page, regardless of how many
 * widgets end up using it (idempotent: concurrent callers share one promise).
 *
 * Rejects rather than hanging if the script neither loads nor errors within
 * SCRIPT_LOAD_TIMEOUT_MS. A rejection is recoverable — the promise is
 * cleared so a later attempt (the resend button, say) retries from scratch
 * instead of replaying the failure forever. */
export function loadTurnstile(): Promise<TurnstileApi> {
  loadPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile)
      return
    }
    const timeoutId = setTimeout(() => {
      reject(new Error('Timed out loading the Turnstile script'))
    }, SCRIPT_LOAD_TIMEOUT_MS)

    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => {
      clearTimeout(timeoutId)
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile script loaded but window.turnstile is missing'))
    }
    script.onerror = () => {
      clearTimeout(timeoutId)
      reject(new Error('Failed to load the Turnstile script'))
    }
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    loadPromise = null
    throw error
  })
  return loadPromise
}

/** Why no token came back. `errorCode` is Cloudflare's own code, only set
 * for `widget-error` — see
 * https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/ */
export type TurnstileFailure =
  | { reason: 'no-site-key' }
  | { reason: 'script-unavailable' }
  | { reason: 'no-container' }
  | { reason: 'render-threw' }
  | { reason: 'widget-error'; errorCode: string }
  | { reason: 'expired' }
  | { reason: 'challenge-timeout' }
  | { reason: 'no-response' }

export type TurnstileResult = { ok: true; token: string } | ({ ok: false } & TurnstileFailure)

export interface RequestTurnstileTokenOptions {
  siteKey: string
  /** Widget rendered by a previous call on this container, removed first. */
  previousWidgetId: string | null
  /** Called with the new widget id as soon as it is rendered. */
  onRendered: (widgetId: string) => void
  /** Called with `true` when Cloudflare is about to show a checkbox, and
   * with `false` on every exit. */
  onInteractiveChange: (isInteractive: boolean) => void
  /** Ceiling on the whole challenge — see TOKEN_TIMEOUT_MS in useTurnstile. */
  timeoutMs: number
}

/**
 * Renders one fresh widget into `container`, executes it, and resolves with
 * either a token or the reason there is none. Never rejects and never hangs:
 * every exit — Turnstile's own callbacks, a throwing `render`, and the
 * `timeoutMs` backstop — goes through one `settle`.
 *
 * Kept free of React so every failure path can be unit-tested against a fake
 * API; `useTurnstile` owns the refs and state around it.
 */
export function requestTurnstileToken(
  api: TurnstileApi,
  container: HTMLElement,
  options: RequestTurnstileTokenOptions,
): Promise<TurnstileResult> {
  return new Promise<TurnstileResult>((resolve) => {
    let settled = false
    const settle = (result: TurnstileResult) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      options.onInteractiveChange(false)
      resolve(result)
    }
    const timeoutId = setTimeout(
      () => settle({ ok: false, reason: 'no-response' }),
      options.timeoutMs,
    )

    try {
      // A Turnstile token is single-use, so every call gets its own widget
      // rather than replaying a spent one.
      if (options.previousWidgetId) api.remove(options.previousWidgetId)
      const widgetId = api.render(container, {
        sitekey: options.siteKey,
        appearance: 'interaction-only',
        execution: 'execute',
        callback: (token) => settle({ ok: true, token }),
        'error-callback': (errorCode) => {
          settle({ ok: false, reason: 'widget-error', errorCode: String(errorCode) })
          return true
        },
        'expired-callback': () => settle({ ok: false, reason: 'expired' }),
        'timeout-callback': () => settle({ ok: false, reason: 'challenge-timeout' }),
        'before-interactive-callback': () => options.onInteractiveChange(true),
      })
      options.onRendered(widgetId)
      api.execute(container)
    } catch {
      settle({ ok: false, reason: 'render-threw' })
    }
  })
}
