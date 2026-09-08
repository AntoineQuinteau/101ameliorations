import { describe, expect, it } from 'vitest'
import { isPointInBbox, type Bbox } from './bbox'

// Service area from spec §4 (bbox lat 43.25–43.80, lon -1.80 to -0.90).
const serviceArea: Bbox = { minLat: 43.25, minLng: -1.8, maxLat: 43.8, maxLng: -0.9 }

describe('isPointInBbox', () => {
  it('accepts a point inside the service area (Bayonne)', () => {
    expect(isPointInBbox(43.49, -1.47, serviceArea)).toBe(true)
  })

  it('rejects a point outside the service area (Paris)', () => {
    expect(isPointInBbox(48.85, 2.35, serviceArea)).toBe(false)
  })

  it('treats the boundary as inclusive', () => {
    expect(isPointInBbox(43.25, -1.8, serviceArea)).toBe(true)
  })
})
