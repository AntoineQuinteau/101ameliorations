import { describe, expect, it } from 'vitest'
import { toGeoJson } from './geojson'
import type { ExportKlash } from '../types/klash'

function makeKlash(overrides: Partial<ExportKlash> = {}): ExportKlash {
  return {
    id: 'k1',
    lat: 43.49,
    lng: -1.47,
    category: 'category_1',
    urgency: 'medium',
    status: 'new',
    title: 'Nid-de-poule',
    description: null,
    duplicateOf: null,
    confirmationsCount: 0,
    commentsCount: 0,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    resolvedAt: null,
    ...overrides,
  }
}

describe('toGeoJson', () => {
  it('produces a FeatureCollection', () => {
    const geojson = toGeoJson([])
    expect(geojson.type).toBe('FeatureCollection')
    expect(geojson.features).toEqual([])
  })

  it('orders coordinates as [lng, lat], not [lat, lng]', () => {
    const geojson = toGeoJson([makeKlash({ lat: 43.49, lng: -1.47 })])
    expect(geojson.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [-1.47, 43.49],
    })
  })

  it('carries every non-geometry field into properties', () => {
    const klash = makeKlash({ title: 'Trou profond', confirmationsCount: 3 })
    const geojson = toGeoJson([klash])
    expect(geojson.features[0].properties).toEqual({
      id: klash.id,
      category: klash.category,
      urgency: klash.urgency,
      status: klash.status,
      title: 'Trou profond',
      description: klash.description,
      duplicateOf: klash.duplicateOf,
      confirmationsCount: 3,
      commentsCount: klash.commentsCount,
      createdAt: klash.createdAt,
      updatedAt: klash.updatedAt,
      resolvedAt: klash.resolvedAt,
    })
  })

  it('does not leak lat/lng into properties', () => {
    const geojson = toGeoJson([makeKlash()])
    expect(geojson.features[0].properties).not.toHaveProperty('lat')
    expect(geojson.features[0].properties).not.toHaveProperty('lng')
  })

  it('produces one feature per row, in order', () => {
    const geojson = toGeoJson([makeKlash({ id: 'a' }), makeKlash({ id: 'b' })])
    expect(geojson.features.map((f) => f.properties.id)).toEqual(['a', 'b'])
  })
})
