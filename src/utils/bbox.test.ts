import { describe, expect, it } from 'vitest'
import { bboxKey, clampBbox, expandBbox, isPointInBbox, roundBbox, type Bbox } from './bbox'

// Arbitrary fixture bbox for these pure-function tests — not the app's real service area.
const sampleArea: Bbox = { minLat: 43.25, minLng: -1.8, maxLat: 43.8, maxLng: -0.9 }

describe('isPointInBbox', () => {
  it('accepts a point inside the service area (Bayonne)', () => {
    expect(isPointInBbox(43.49, -1.47, sampleArea)).toBe(true)
  })

  it('rejects a point outside the service area (Paris)', () => {
    expect(isPointInBbox(48.85, 2.35, sampleArea)).toBe(false)
  })

  it('treats the boundary as inclusive', () => {
    expect(isPointInBbox(43.25, -1.8, sampleArea)).toBe(true)
  })
})

describe('expandBbox', () => {
  it('pads each side by the given fraction of its own span', () => {
    const bbox: Bbox = { minLat: 43.4, minLng: -1.5, maxLat: 43.6, maxLng: -1.3 }
    const expanded = expandBbox(bbox, 0.25)
    expect(expanded.minLat).toBeCloseTo(43.35)
    expect(expanded.minLng).toBeCloseTo(-1.55)
    expect(expanded.maxLat).toBeCloseTo(43.65)
    expect(expanded.maxLng).toBeCloseTo(-1.25)
  })

  it('returns the same bbox for a zero factor', () => {
    const bbox: Bbox = { minLat: 43.4, minLng: -1.5, maxLat: 43.6, maxLng: -1.3 }
    expect(expandBbox(bbox, 0)).toEqual(bbox)
  })
})

describe('roundBbox', () => {
  it('snaps mins down and maxes up to the given number of decimals', () => {
    const bbox: Bbox = { minLat: 43.49123, minLng: -1.47456, maxLat: 43.50789, maxLng: -1.46001 }
    expect(roundBbox(bbox, 2)).toEqual({
      minLat: 43.49,
      minLng: -1.48,
      maxLat: 43.51,
      maxLng: -1.46,
    })
  })

  it('never collapses a narrow viewport into a zero-area bbox', () => {
    // ~200m-wide viewport at high zoom: both bounds would round to the same
    // 2-decimal (~1.1km) value, and the map would then match zero klashs.
    const narrow: Bbox = { minLat: 43.49, minLng: -1.47, maxLat: 43.4918, maxLng: -1.4682 }
    const rounded = roundBbox(narrow, 2)
    expect(rounded.minLat).toBeLessThan(rounded.maxLat)
    expect(rounded.minLng).toBeLessThan(rounded.maxLng)
  })

  it('collapses a small pan onto the same rounded bbox', () => {
    const before: Bbox = { minLat: 43.491, minLng: -1.474, maxLat: 43.501, maxLng: -1.464 }
    const after: Bbox = { minLat: 43.492, minLng: -1.473, maxLat: 43.502, maxLng: -1.463 }
    expect(roundBbox(before, 2)).toEqual(roundBbox(after, 2))
  })
})

describe('clampBbox', () => {
  it('leaves a bbox already inside the bounds untouched', () => {
    const bbox: Bbox = { minLat: 43.4, minLng: -1.5, maxLat: 43.6, maxLng: -1.3 }
    expect(clampBbox(bbox, sampleArea)).toEqual(bbox)
  })

  it('clamps a bbox that overshoots the service area', () => {
    const bbox: Bbox = { minLat: 43.0, minLng: -2.0, maxLat: 44.0, maxLng: -0.5 }
    expect(clampBbox(bbox, sampleArea)).toEqual(sampleArea)
  })

  it('leaves a bbox untouched when the bounds are wider than it', () => {
    const bbox: Bbox = { minLat: 43.4, minLng: -1.5, maxLat: 43.6, maxLng: -1.3 }
    const wideBounds: Bbox = { minLat: 42.7, minLng: -2.3, maxLat: 45.0, maxLng: 0.5 }
    expect(clampBbox(bbox, wideBounds)).toEqual(bbox)
  })
})

describe('bboxKey', () => {
  it('produces distinct keys for distinct bboxes', () => {
    const a: Bbox = { minLat: 43.4, minLng: -1.5, maxLat: 43.6, maxLng: -1.3 }
    const b: Bbox = { minLat: 43.5, minLng: -1.5, maxLat: 43.6, maxLng: -1.3 }
    expect(bboxKey(a)).not.toBe(bboxKey(b))
  })

  it('produces the same key for the same bbox', () => {
    const bbox: Bbox = { minLat: 43.4, minLng: -1.5, maxLat: 43.6, maxLng: -1.3 }
    expect(bboxKey(bbox)).toBe(bboxKey({ ...bbox }))
  })
})
