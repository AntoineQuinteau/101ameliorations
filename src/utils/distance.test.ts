import { describe, expect, it } from 'vitest'
import { distanceMeters } from './distance'

describe('distanceMeters', () => {
  it('returns 0 for the same point', () => {
    expect(distanceMeters(43.49, -1.47, 43.49, -1.47)).toBeCloseTo(0)
  })

  it('matches a known distance between two cities (Bayonne to Biarritz, ~7 km)', () => {
    const bayonne = { lat: 43.4929, lng: -1.4749 }
    const biarritz = { lat: 43.4832, lng: -1.5586 }
    const distance = distanceMeters(bayonne.lat, bayonne.lng, biarritz.lat, biarritz.lng)
    expect(distance).toBeGreaterThan(6_000)
    expect(distance).toBeLessThan(8_000)
  })

  it('is symmetric', () => {
    const a = { lat: 43.49, lng: -1.47 }
    const b = { lat: 43.5, lng: -1.46 }
    expect(distanceMeters(a.lat, a.lng, b.lat, b.lng)).toBeCloseTo(
      distanceMeters(b.lat, b.lng, a.lat, a.lng),
    )
  })

  it('matches a precise short distance (~111 m for 0.001 degree of latitude)', () => {
    const distance = distanceMeters(43.49, -1.47, 43.491, -1.47)
    expect(distance).toBeCloseTo(111, -1) // within 10m
  })
})
