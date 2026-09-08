import { describe, expect, it } from 'vitest'
import { getMarkerVariant } from './markerIcons'

describe('getMarkerVariant', () => {
  it('colors an active klash by urgency', () => {
    expect(getMarkerVariant('low', 'new').color).toBe('#16a34a')
    expect(getMarkerVariant('medium', 'new').color).toBe('#d97706')
    expect(getMarkerVariant('high', 'new').color).toBe('#dc2626')
  })

  it('gives active klashs full opacity', () => {
    expect(getMarkerVariant('high', 'in_progress').opacity).toBe(1)
  })

  it('mutes a resolved klash regardless of urgency', () => {
    const low = getMarkerVariant('low', 'resolved')
    const high = getMarkerVariant('high', 'resolved')
    expect(low.color).toBe(high.color)
    expect(low.opacity).toBeLessThan(1)
  })
})
