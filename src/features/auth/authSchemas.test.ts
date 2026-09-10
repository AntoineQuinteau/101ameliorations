import { describe, expect, it } from 'vitest'
import { displayNameSchema, emailSchema, otpCodeSchema, sanitizeOtpInput } from './authSchemas'

describe('emailSchema', () => {
  it('trims and lowercases a valid email', () => {
    expect(emailSchema.parse('  A@B.COM  ')).toBe('a@b.com')
  })

  it('rejects an invalid email', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false)
  })
})

describe('otpCodeSchema', () => {
  it('accepts a 6-digit code', () => {
    expect(otpCodeSchema.safeParse('123456').success).toBe(true)
  })

  it('rejects a 5-digit code', () => {
    expect(otpCodeSchema.safeParse('12345').success).toBe(false)
  })

  it('rejects a 7-digit code', () => {
    expect(otpCodeSchema.safeParse('1234567').success).toBe(false)
  })

  it('rejects a code containing letters', () => {
    expect(otpCodeSchema.safeParse('12a456').success).toBe(false)
  })
})

describe('displayNameSchema', () => {
  it('accepts the minimum length (2 chars)', () => {
    expect(displayNameSchema.safeParse('Al').success).toBe(true)
  })

  it('accepts the maximum length (40 chars)', () => {
    expect(displayNameSchema.safeParse('A'.repeat(40)).success).toBe(true)
  })

  it('rejects 1 character', () => {
    expect(displayNameSchema.safeParse('A').success).toBe(false)
  })

  it('rejects 41 characters', () => {
    expect(displayNameSchema.safeParse('A'.repeat(41)).success).toBe(false)
  })

  it('trims before measuring length', () => {
    expect(displayNameSchema.parse('  ab  ')).toBe('ab')
  })
})

describe('sanitizeOtpInput', () => {
  it('strips non-digit characters', () => {
    expect(sanitizeOtpInput('123 456')).toBe('123456')
  })

  it('truncates to 6 digits', () => {
    expect(sanitizeOtpInput('1234567890')).toBe('123456')
  })

  it('handles an empty string', () => {
    expect(sanitizeOtpInput('')).toBe('')
  })
})
