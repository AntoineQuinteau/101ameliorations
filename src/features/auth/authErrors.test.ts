import { AuthError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { authErrorMessageKey } from './authErrors'

function authError(code: string | undefined, status: number | undefined): AuthError {
  const error = new AuthError('message', status, code)
  return error
}

describe('authErrorMessageKey', () => {
  it('maps otp_expired to invalidOrExpiredCode (also covers a wrong code, not just an expired one)', () => {
    expect(authErrorMessageKey(authError('otp_expired', 403))).toBe('invalidOrExpiredCode')
  })

  it('maps otp_disabled to invalidOrExpiredCode', () => {
    expect(authErrorMessageKey(authError('otp_disabled', 403))).toBe('invalidOrExpiredCode')
  })

  it('maps over_email_send_rate_limit to rateLimited', () => {
    expect(authErrorMessageKey(authError('over_email_send_rate_limit', 429))).toBe('rateLimited')
  })

  it('maps over_request_rate_limit to rateLimited', () => {
    expect(authErrorMessageKey(authError('over_request_rate_limit', 429))).toBe('rateLimited')
  })

  it('maps validation_failed to invalidEmail', () => {
    expect(authErrorMessageKey(authError('validation_failed', 400))).toBe('invalidEmail')
  })

  it('maps signup_disabled to signupDisabled', () => {
    expect(authErrorMessageKey(authError('signup_disabled', 422))).toBe('signupDisabled')
  })

  it('maps a response-less failure (offline) to network', () => {
    expect(authErrorMessageKey(authError(undefined, undefined))).toBe('network')
  })

  it('maps an unmapped code with a 429 status to rateLimited', () => {
    expect(authErrorMessageKey(authError('some_new_code', 429))).toBe('rateLimited')
  })

  it('maps an unmapped code to unknown', () => {
    expect(authErrorMessageKey(authError('some_new_code', 500))).toBe('unknown')
  })

  it('maps a plain Error to unknown', () => {
    expect(authErrorMessageKey(new Error('boom'))).toBe('unknown')
  })

  it('maps null, undefined and a string to unknown without throwing', () => {
    expect(authErrorMessageKey(null)).toBe('unknown')
    expect(authErrorMessageKey(undefined)).toBe('unknown')
    expect(authErrorMessageKey('boom')).toBe('unknown')
  })
})
