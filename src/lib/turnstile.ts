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

export interface TurnstileRenderOptions {
  sitekey: string
  callback: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
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
 * widgets end up using it (idempotent: concurrent callers share one promise). */
export function loadTurnstile(): Promise<TurnstileApi> {
  loadPromise ??= new Promise((resolve, reject) => {
    if (window.turnstile) {
      resolve(window.turnstile)
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile script loaded but window.turnstile is missing'))
    }
    script.onerror = () => reject(new Error('Failed to load the Turnstile script'))
    document.head.appendChild(script)
  })
  return loadPromise
}
