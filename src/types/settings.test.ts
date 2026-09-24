import { describe, expect, it } from 'vitest'
import { serviceAreaBboxFromValue, tileProviderFromValue } from './settings'

describe('serviceAreaBboxFromValue', () => {
  it('maps the real production row to a Bbox', () => {
    expect(
      serviceAreaBboxFromValue({ min_lat: 42.7, min_lng: -2.3, max_lat: 45.0, max_lng: 0.5 }),
    ).toEqual({ minLat: 42.7, minLng: -2.3, maxLat: 45.0, maxLng: 0.5 })
  })

  it('throws on a missing key', () => {
    expect(() =>
      serviceAreaBboxFromValue({ min_lat: 42.7, min_lng: -2.3, max_lat: 45.0 }),
    ).toThrow()
  })

  it('throws on a number encoded as a string, without coercing it', () => {
    expect(() =>
      serviceAreaBboxFromValue({ min_lat: '42.7', min_lng: -2.3, max_lat: 45.0, max_lng: 0.5 }),
    ).toThrow()
  })

  it('throws on inverted bounds', () => {
    expect(() =>
      serviceAreaBboxFromValue({ min_lat: 45.0, min_lng: -2.3, max_lat: 42.7, max_lng: 0.5 }),
    ).toThrow()
  })

  it('throws on an out-of-range latitude', () => {
    expect(() =>
      serviceAreaBboxFromValue({ min_lat: 100, min_lng: -2.3, max_lat: 45.0, max_lng: 0.5 }),
    ).toThrow()
  })

  it('throws on null', () => {
    expect(() => serviceAreaBboxFromValue(null)).toThrow()
  })

  it('throws on an array', () => {
    expect(() => serviceAreaBboxFromValue([42.7, -2.3, 45.0, 0.5])).toThrow()
  })
})

describe('tileProviderFromValue', () => {
  it('accepts "maptiler"', () => {
    expect(tileProviderFromValue('maptiler')).toBe('maptiler')
  })

  it('accepts "ign"', () => {
    expect(tileProviderFromValue('ign')).toBe('ign')
  })

  it('throws on an unknown provider', () => {
    expect(() => tileProviderFromValue('mapbox')).toThrow()
  })

  it('throws on the service_area_bbox shape by mistake', () => {
    expect(() =>
      tileProviderFromValue({ min_lat: 42.7, min_lng: -2.3, max_lat: 45.0, max_lng: 0.5 }),
    ).toThrow()
  })

  it('throws on null', () => {
    expect(() => tileProviderFromValue(null)).toThrow()
  })
})
