import { describe, expect, it } from 'vitest'
import { landingPageviewUrl } from './landingPageviewUrl'

describe('landingPageviewUrl', () => {
  it('keeps utm parameters so the tracker can read them', () => {
    expect(landingPageviewUrl('/', '?utm_source=cpam&utm_medium=print')).toBe(
      '/?utm_source=cpam&utm_medium=print',
    )
  })
  it('drops the iOS launch attribution parameters', () => {
    expect(landingPageviewUrl('/', '?launch=pwa&ft=cpam_print___&lt=a&fs=2026-10-01')).toBe(
      '/?launch=pwa',
    )
  })
  it('is just the path without a query', () => {
    expect(landingPageviewUrl('/k/abc', '')).toBe('/k/abc')
  })
})
