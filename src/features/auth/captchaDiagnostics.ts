import * as Sentry from '@sentry/react'
import { AuthError } from '@supabase/supabase-js'
import type { TurnstileResult } from '../../lib/turnstile'

/**
 * GoTrue reports a rejected captcha as
 * `captcha protection: request disallowed (<reason>)`, where `<reason>` is
 * either Cloudflare siteverify's own error codes (`invalid-input-secret`,
 * `invalid-input-response`, `timeout-or-duplicate`…) or
 * `no captcha_token found` when the request carried no token at all.
 */
function gotrueCaptchaReason(error: unknown): string | null {
  if (!(error instanceof AuthError)) return null
  const match = /request disallowed \(([^)]*)\)/.exec(error.message)
  return match ? match[1].trim() : null
}

/**
 * A short, stable code shown next to the captcha error message, so a
 * screenshot from any visitor is enough to tell which piece failed:
 *
 * - `turnstile-<code>`: Cloudflare's widget refused to issue a token (e.g.
 *   `turnstile-110200`: hostname not allowed in the widget settings);
 * - `turnstile-<reason>`: no token for another client-side reason (script
 *   blocked, challenge timed out, no site key in the build…);
 * - otherwise the token was sent and Supabase rejected it: siteverify's own
 *   code (e.g. `invalid-input-secret`: the secret in Supabase is wrong).
 */
export function captchaFailureRef(result: TurnstileResult, error: unknown): string {
  if (!result.ok) {
    return result.reason === 'widget-error'
      ? `turnstile-${result.errorCode}`
      : `turnstile-${result.reason}`
  }
  const reason = gotrueCaptchaReason(error)
  return reason ? reason.replace(/\s+/g, '-') : 'rejected'
}

/** Logs and reports a `captcha_failed`. Never includes the email (spec §2). */
export function reportCaptchaFailure(result: TurnstileResult, error: unknown): void {
  const ref = captchaFailureRef(result, error)
  const gotrueMessage = error instanceof Error ? error.message : String(error)
  console.warn(`[captcha] OTP request rejected — ref ${ref}`, {
    turnstile: result.ok ? 'token' : result,
    gotrueMessage,
  })
  Sentry.captureMessage('captcha_failed', {
    level: 'error',
    tags: { captcha_ref: ref, turnstile_ok: String(result.ok) },
    extra: {
      turnstile: result.ok ? 'token' : result,
      gotrueMessage,
      hostname: window.location.hostname,
    },
  })
}
