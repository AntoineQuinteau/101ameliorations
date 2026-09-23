import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from './formatDate'

describe('formatDate', () => {
  it('formats an ISO timestamp as a French long date', () => {
    expect(formatDate('2026-09-08T12:00:00Z')).toBe('8 septembre 2026')
  })

  it('formats a single-digit day without leading zero', () => {
    expect(formatDate('2026-01-01T00:00:00Z')).toBe('1 janvier 2026')
  })
})

describe('formatDateTime', () => {
  it('formats an ISO timestamp as a French long date and time', () => {
    expect(formatDateTime('2026-09-08T12:00:00Z')).toBe('8 septembre 2026 à 14:00')
  })
})
