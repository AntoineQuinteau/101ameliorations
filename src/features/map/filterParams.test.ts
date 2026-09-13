import { describe, expect, it } from 'vitest'
import { filtersFromSearchParams, filtersToSearchParams } from './filterParams'
import { defaultFilters, type KlashFilters } from './klashFilters'

describe('filtersToSearchParams', () => {
  it('produces no params for the default filters and sort', () => {
    const params = filtersToSearchParams(defaultFilters, 'recent')
    expect(params.toString()).toBe('')
  })

  it('writes only the dimensions that differ from the default', () => {
    const filters: KlashFilters = { ...defaultFilters, categories: ['category_1'] }
    const params = filtersToSearchParams(filters, 'recent')
    expect(params.get('category')).toBe('category_1')
    expect(params.has('urgency')).toBe(false)
    expect(params.has('status')).toBe(false)
    expect(params.has('sort')).toBe(false)
  })

  it('writes the sort when it is not the default', () => {
    const params = filtersToSearchParams(defaultFilters, 'confirmed')
    expect(params.get('sort')).toBe('confirmed')
  })

  it('writes visibleAreaOnly as a short flag', () => {
    const filters: KlashFilters = { ...defaultFilters, visibleAreaOnly: true }
    expect(filtersToSearchParams(filters, 'recent').get('area')).toBe('1')
  })
})

describe('filtersFromSearchParams', () => {
  it('returns the defaults for an empty URL', () => {
    const { filters, sort } = filtersFromSearchParams(new URLSearchParams(''))
    expect(filters).toEqual(defaultFilters)
    expect(sort).toBe('recent')
  })

  it('round-trips a non-default filter set through the URL', () => {
    const original: KlashFilters = {
      categories: ['category_1', 'category_3'],
      urgencies: ['high'],
      statuses: ['new', 'in_progress'],
      createdAfter: '2026-01-01',
      visibleAreaOnly: true,
    }
    const params = filtersToSearchParams(original, 'confirmed')
    const { filters, sort } = filtersFromSearchParams(params)
    expect(filters).toEqual(original)
    expect(sort).toBe('confirmed')
  })

  it('ignores an unknown category value instead of crashing', () => {
    const { filters } = filtersFromSearchParams(
      new URLSearchParams('category=category_1,not-a-category'),
    )
    expect(filters.categories).toEqual(['category_1'])
  })

  it('falls back to the default category list when every value is unknown', () => {
    const { filters } = filtersFromSearchParams(new URLSearchParams('category=bogus'))
    expect(filters.categories).toEqual(defaultFilters.categories)
  })

  it('ignores a malformed since date', () => {
    const { filters } = filtersFromSearchParams(new URLSearchParams('since=not-a-date'))
    expect(filters.createdAfter).toBeNull()
  })

  it('accepts a well-formed since date', () => {
    const { filters } = filtersFromSearchParams(new URLSearchParams('since=2026-03-15'))
    expect(filters.createdAfter).toBe('2026-03-15')
  })

  it('falls back to the default sort for an unknown sort value', () => {
    const { sort } = filtersFromSearchParams(new URLSearchParams('sort=bogus'))
    expect(sort).toBe('recent')
  })
})
