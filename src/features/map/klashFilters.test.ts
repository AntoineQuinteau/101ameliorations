import { describe, expect, it } from 'vitest'
import { applyFilters, defaultFilters, isDefaultFilters, type KlashFilters } from './klashFilters'
import type { Klash } from '../../types/klash'

function makeKlash(overrides: Partial<Klash> = {}): Klash {
  return {
    id: 'k1',
    authorId: 'a1',
    lat: 43.49,
    lng: -1.47,
    category: 'category_1',
    categoryOther: null,
    importance: 'medium',
    status: 'new',
    title: 'Test klash',
    description: null,
    proposedSolution: null,
    duplicateOf: null,
    confirmationsCount: 0,
    commentsCount: 0,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    resolvedAt: null,
    authorDisplayName: null,
    authorOrganization: null,
    authorRole: 'user',
    ...overrides,
  }
}

describe('applyFilters', () => {
  it('keeps every klash under the default filters', () => {
    const klashes = [makeKlash({ status: 'new' }), makeKlash({ id: 'k2', status: 'resolved' })]
    expect(applyFilters(klashes, defaultFilters)).toHaveLength(2)
  })

  it('filters by category', () => {
    const klashes = [
      makeKlash({ id: 'k1', category: 'category_1' }),
      makeKlash({ id: 'k2', category: 'category_2' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, categories: ['category_1'] }
    expect(applyFilters(klashes, filters).map((k) => k.id)).toEqual(['k1'])
  })

  it('filters by importance', () => {
    const klashes = [
      makeKlash({ id: 'k1', importance: 'low' }),
      makeKlash({ id: 'k2', importance: 'high' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, importances: ['high'] }
    expect(applyFilters(klashes, filters).map((k) => k.id)).toEqual(['k2'])
  })

  it('filters by status', () => {
    const klashes = [
      makeKlash({ id: 'k1', status: 'new' }),
      makeKlash({ id: 'k2', status: 'rejected' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, statuses: ['new'] }
    expect(applyFilters(klashes, filters).map((k) => k.id)).toEqual(['k1'])
  })

  it('filters by period (createdAfter)', () => {
    const klashes = [
      makeKlash({ id: 'k1', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeKlash({ id: 'k2', createdAt: '2026-06-01T00:00:00.000Z' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, createdAfter: '2026-03-01' }
    expect(applyFilters(klashes, filters).map((k) => k.id)).toEqual(['k2'])
  })

  it('cumulates multiple active filters', () => {
    const klashes = [
      makeKlash({ id: 'k1', category: 'category_1', importance: 'high' }),
      makeKlash({ id: 'k2', category: 'category_1', importance: 'low' }),
      makeKlash({ id: 'k3', category: 'category_2', importance: 'high' }),
    ]
    const filters: KlashFilters = {
      ...defaultFilters,
      categories: ['category_1'],
      importances: ['high'],
    }
    expect(applyFilters(klashes, filters).map((k) => k.id)).toEqual(['k1'])
  })

  it('returns an empty array when nothing matches', () => {
    const klashes = [makeKlash({ category: 'category_1' })]
    const filters: KlashFilters = { ...defaultFilters, categories: ['category_2'] }
    expect(applyFilters(klashes, filters)).toEqual([])
  })
})

describe('isDefaultFilters', () => {
  it('is true for the default filters object', () => {
    expect(isDefaultFilters(defaultFilters)).toBe(true)
  })

  it('is true for an equivalent filters object built independently', () => {
    const filters: KlashFilters = {
      categories: [...defaultFilters.categories].reverse(),
      importances: [...defaultFilters.importances],
      statuses: [...defaultFilters.statuses],
      createdAfter: null,
    }
    expect(isDefaultFilters(filters)).toBe(true)
  })

  it('is false once any dimension narrows', () => {
    expect(isDefaultFilters({ ...defaultFilters, categories: ['category_1'] })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters, importances: ['high'] })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters, statuses: ['new'] })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters, createdAfter: '2026-01-01' })).toBe(false)
  })
})
