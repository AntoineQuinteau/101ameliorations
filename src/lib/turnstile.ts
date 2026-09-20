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
  'error-callback'?: () => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
  'before-interactive-callback'?: () => void
  appearance?: 'always' | 'execute' | 'interaction-only'
  execution?: 'render' | 'execute'
  size?: 'normal' | 'compact' | 'invisible'
}

interface TurnstileApi {
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
