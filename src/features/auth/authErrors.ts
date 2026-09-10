import { AuthError } from '@supabase/supabase-js'

/** Keys of `fr.login.errors`. */
export type LoginErrorKey =
  'invalidEmail' | 'invalidOrExpiredCode' | 'rateLimited' | 'signupDisabled' | 'network' | 'unknown'

/**
 * Maps a Supabase auth failure to a French message key.
 *
 * GoTrue returns `otp_expired` both for a genuinely expired code and for a
 * wrong one (verified against gotrue v2.196.0: posting a bogus 6-digit token
 * yields `403 otp_expired "Token has expired or is invalid"`). The two cases
 * are indistinguishable, so they share one message that doesn't claim either.
 */
export function authErrorMessageKey(error: unknown): LoginErrorKey {
  if (!(error instanceof AuthError)) return 'unknown'

  switch (error.code) {
    case 'otp_expired':
    case 'otp_disabled':
      return 'invalidOrExpiredCode'
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'rateLimited'
    case 'validation_failed':
    case 'email_address_invalid':
    case 'email_address_not_authorized':
      return 'invalidEmail'
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'signupDisabled'
    default:
      break
  }

  // A failure before any response is received (offline, DNS, CORS) carries
  // neither a code nor a status.
  if (error.code === undefined && error.status === undefined) return 'network'
  if (error.status === 429) return 'rateLimited'
  return 'unknown'
}
