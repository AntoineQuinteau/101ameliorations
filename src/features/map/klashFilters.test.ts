import { describe, expect, it } from 'vitest'
import {
  applyFilters,
  defaultFilters,
  isDefaultFilters,
  sortKlashes,
  type KlashFilters,
} from './klashFilters'
import type { Klash } from '../../types/klash'

function makeKlash(overrides: Partial<Klash> = {}): Klash {
  return {
    id: 'k1',
    authorId: 'a1',
    lat: 43.49,
    lng: -1.47,
    category: 'category_1',
    urgency: 'medium',
    status: 'new',
    title: 'Test klash',
    description: null,
    duplicateOf: null,
    confirmationsCount: 0,
    commentsCount: 0,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    resolvedAt: null,
    authorDisplayName: null,
    authorOrganization: null,
    ...overrides,
  }
}

describe('applyFilters', () => {
  it('keeps every klash under the default filters', () => {
    const klashes = [makeKlash({ status: 'new' }), makeKlash({ id: 'k2', status: 'resolved' })]
    expect(applyFilters(klashes, defaultFilters, null)).toHaveLength(2)
  })

  it('filters by category', () => {
    const klashes = [
      makeKlash({ id: 'k1', category: 'category_1' }),
      makeKlash({ id: 'k2', category: 'category_2' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, categories: ['category_1'] }
    expect(applyFilters(klashes, filters, null).map((k) => k.id)).toEqual(['k1'])
  })

  it('filters by urgency', () => {
    const klashes = [
      makeKlash({ id: 'k1', urgency: 'low' }),
      makeKlash({ id: 'k2', urgency: 'high' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, urgencies: ['high'] }
    expect(applyFilters(klashes, filters, null).map((k) => k.id)).toEqual(['k2'])
  })

  it('filters by status', () => {
    const klashes = [
      makeKlash({ id: 'k1', status: 'new' }),
      makeKlash({ id: 'k2', status: 'rejected' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, statuses: ['new'] }
    expect(applyFilters(klashes, filters, null).map((k) => k.id)).toEqual(['k1'])
  })

  it('filters by period (createdAfter)', () => {
    const klashes = [
      makeKlash({ id: 'k1', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeKlash({ id: 'k2', createdAt: '2026-06-01T00:00:00.000Z' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, createdAfter: '2026-03-01' }
    expect(applyFilters(klashes, filters, null).map((k) => k.id)).toEqual(['k2'])
  })

  it('cumulates multiple active filters', () => {
    const klashes = [
      makeKlash({ id: 'k1', category: 'category_1', urgency: 'high' }),
      makeKlash({ id: 'k2', category: 'category_1', urgency: 'low' }),
      makeKlash({ id: 'k3', category: 'category_2', urgency: 'high' }),
    ]
    const filters: KlashFilters = {
      ...defaultFilters,
      categories: ['category_1'],
      urgencies: ['high'],
    }
    expect(applyFilters(klashes, filters, null).map((k) => k.id)).toEqual(['k1'])
  })

  it('returns an empty array when nothing matches', () => {
    const klashes = [makeKlash({ category: 'category_1' })]
    const filters: KlashFilters = { ...defaultFilters, categories: ['category_2'] }
    expect(applyFilters(klashes, filters, null)).toEqual([])
  })

  describe('visibleAreaOnly', () => {
    const bbox = { minLat: 43.0, minLng: -2.0, maxLat: 44.0, maxLng: -1.0 }

    it('keeps a klash inside the viewport bbox', () => {
      const klashes = [makeKlash({ lat: 43.5, lng: -1.5 })]
      const filters: KlashFilters = { ...defaultFilters, visibleAreaOnly: true }
      expect(applyFilters(klashes, filters, bbox)).toHaveLength(1)
    })

    it('excludes a klash outside the viewport bbox', () => {
      const klashes = [makeKlash({ lat: 45.0, lng: -1.5 })]
      const filters: KlashFilters = { ...defaultFilters, visibleAreaOnly: true }
      expect(applyFilters(klashes, filters, bbox)).toEqual([])
    })

    it('has no effect when there is no known viewport yet', () => {
      const klashes = [makeKlash({ lat: 45.0, lng: -1.5 })]
      const filters: KlashFilters = { ...defaultFilters, visibleAreaOnly: true }
      expect(applyFilters(klashes, filters, null)).toHaveLength(1)
    })
  })
})

describe('isDefaultFilters', () => {
  it('is true for the default filters object', () => {
    expect(isDefaultFilters(defaultFilters)).toBe(true)
  })

  it('is true for an equivalent filters object built independently', () => {
    const filters: KlashFilters = {
      categories: [...defaultFilters.categories].reverse(),
      urgencies: [...defaultFilters.urgencies],
      statuses: [...defaultFilters.statuses],
      createdAfter: null,
      visibleAreaOnly: false,
    }
    expect(isDefaultFilters(filters)).toBe(true)
  })

  it('is false once any dimension narrows', () => {
    expect(isDefaultFilters({ ...defaultFilters, categories: ['category_1'] })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters, urgencies: ['high'] })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters, statuses: ['new'] })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters, createdAfter: '2026-01-01' })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters, visibleAreaOnly: true })).toBe(false)
  })
})

describe('sortKlashes', () => {
  it('sorts by most recent first', () => {
    const klashes = [
      makeKlash({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeKlash({ id: 'new', createdAt: '2026-06-01T00:00:00.000Z' }),
    ]
    expect(sortKlashes(klashes, 'recent').map((k) => k.id)).toEqual(['new', 'old'])
  })

  it('sorts by most confirmed first', () => {
    const klashes = [
      makeKlash({ id: 'few', confirmationsCount: 1 }),
      makeKlash({ id: 'many', confirmationsCount: 10 }),
    ]
    expect(sortKlashes(klashes, 'confirmed').map((k) => k.id)).toEqual(['many', 'few'])
  })

  it('does not mutate the input array', () => {
    const klashes = [
      makeKlash({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeKlash({ id: 'b', createdAt: '2026-06-01T00:00:00.000Z' }),
    ]
    const original = [...klashes]
    sortKlashes(klashes, 'recent')
    expect(klashes).toEqual(original)
  })
})
