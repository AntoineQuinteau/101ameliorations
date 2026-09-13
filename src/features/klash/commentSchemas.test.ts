import { describe, expect, it } from 'vitest'
import { commentBodySchema, mapCommentError } from './commentSchemas'

describe('commentBodySchema', () => {
  it('accepts the minimum length (1 char)', () => {
    expect(commentBodySchema.safeParse('!').success).toBe(true)
  })

  it('accepts the maximum length (1000 chars)', () => {
    expect(commentBodySchema.safeParse('a'.repeat(1000)).success).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(commentBodySchema.safeParse('').success).toBe(false)
  })

  it('rejects 1001 characters', () => {
    expect(commentBodySchema.safeParse('a'.repeat(1001)).success).toBe(false)
  })

  it('trims before measuring length', () => {
    expect(commentBodySchema.parse('  bonjour  ')).toBe('bonjour')
  })

  it('rejects a string that is only whitespace', () => {
    expect(commentBodySchema.safeParse('   ').success).toBe(false)
  })
})

describe('mapCommentError', () => {
  it('maps a rate limit error to the rate-limited message', () => {
    expect(
      mapCommentError(
        new Error('rate limit exceeded: max 50 comments per 24h'),
        'fallback',
        'rate limited',
      ),
    ).toBe('rate limited')
  })

  it('maps any other error to the fallback message', () => {
    expect(mapCommentError(new Error('network error'), 'fallback', 'rate limited')).toBe('fallback')
  })

  it('maps a non-Error value to the fallback message', () => {
    expect(mapCommentError('not an error', 'fallback', 'rate limited')).toBe('fallback')
  })
})
