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
      makeKlash({ id: 'k2', status: 'resolved' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, statuses: ['new'] }
    expect(applyFilters(klashes, filters).map((k) => k.id)).toEqual(['k1'])
  })

  it('filters by period, as a window rolling back from now', () => {
    const klashes = [
      makeKlash({ id: 'k1', createdAt: '2026-05-20T00:00:00.000Z' }),
      makeKlash({ id: 'k2', createdAt: '2026-06-01T00:00:00.000Z' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, period: '7d' }
    const now = new Date('2026-06-05T12:00:00.000Z')
    expect(applyFilters(klashes, filters, now).map((k) => k.id)).toEqual(['k2'])
    // The same filters a month later: the window has moved on past both.
    const later = new Date('2026-07-05T12:00:00.000Z')
    expect(applyFilters(klashes, filters, later)).toEqual([])
  })

  it('treats several values in one dimension as "any of"', () => {
    const klashes = [
      makeKlash({ id: 'k1', category: 'category_1' }),
      makeKlash({ id: 'k2', category: 'category_2' }),
      makeKlash({ id: 'k3', category: 'category_3' }),
    ]
    const filters: KlashFilters = { ...defaultFilters, categories: ['category_1', 'category_3'] }
    expect(applyFilters(klashes, filters).map((k) => k.id)).toEqual(['k1', 'k3'])
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
    const filters: KlashFilters = { categories: [], importances: [], statuses: [], period: null }
    expect(isDefaultFilters(filters)).toBe(true)
  })

  it('is false once any dimension narrows', () => {
    expect(isDefaultFilters({ ...defaultFilters, categories: ['category_1'] })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters, importances: ['high'] })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters, statuses: ['new'] })).toBe(false)
    expect(isDefaultFilters({ ...defaultFilters, period: '30d' })).toBe(false)
  })
})
