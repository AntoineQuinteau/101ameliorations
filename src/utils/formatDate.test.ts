import { describe, expect, it, vi } from 'vitest'
import { daysAgoIso, formatDate, formatDateTime } from './formatDate'

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

describe('daysAgoIso', () => {
  it('returns an ISO timestamp N days before now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'))
    expect(daysAgoIso(7)).toBe('2026-09-08T12:00:00.000Z')
    vi.useRealTimers()
  })
})
