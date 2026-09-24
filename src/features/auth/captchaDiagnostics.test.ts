import { AuthError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { captchaFailureRef } from './captchaDiagnostics'

const captchaError = (reason: string) =>
  new AuthError(`captcha protection: request disallowed (${reason})`, 400, 'captcha_failed')

describe('captchaFailureRef', () => {
  it("names Cloudflare's widget error code when no token was issued", () => {
    expect(
      captchaFailureRef(
        { ok: false, reason: 'widget-error', errorCode: '110200' },
        captchaError('no captcha_token found'),
      ),
    ).toBe('turnstile-110200')
  })

  it('names the client-side reason for any other missing token', () => {
    expect(captchaFailureRef({ ok: false, reason: 'script-unavailable' }, captchaError('x'))).toBe(
      'turnstile-script-unavailable',
    )
    expect(captchaFailureRef({ ok: false, reason: 'no-site-key' }, captchaError('x'))).toBe(
      'turnstile-no-site-key',
    )
  })

  it("uses siteverify's code when a token was sent but rejected", () => {
    expect(captchaFailureRef({ ok: true, token: 't' }, captchaError('invalid-input-secret'))).toBe(
      'invalid-input-secret',
    )
  })

  it('handles the no-token message observed in production', () => {
    expect(
      captchaFailureRef({ ok: true, token: 't' }, captchaError('no captcha_token found')),
    ).toBe('no-captcha_token-found')
  })

  it('falls back to "rejected" on an unrecognised message', () => {
    expect(
      captchaFailureRef(
        { ok: true, token: 't' },
        new AuthError('something else', 400, 'captcha_failed'),
      ),
    ).toBe('rejected')
  })
})
