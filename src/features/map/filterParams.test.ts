import { describe, expect, it } from 'vitest'
import { filtersFromSearchParams, filtersToSearchParams } from './filterParams'
import { defaultFilters, type KlashFilters } from './klashFilters'

describe('filtersToSearchParams', () => {
  it('produces no params for the default filters', () => {
    const params = filtersToSearchParams(defaultFilters)
    expect(params.toString()).toBe('')
  })

  it('writes only the dimensions that differ from the default', () => {
    const filters: KlashFilters = { ...defaultFilters, categories: ['category_1'] }
    const params = filtersToSearchParams(filters)
    expect(params.get('category')).toBe('category_1')
    expect(params.has('importance')).toBe(false)
    expect(params.has('status')).toBe(false)
  })
})

describe('filtersFromSearchParams', () => {
  it('returns the defaults for an empty URL', () => {
    const filters = filtersFromSearchParams(new URLSearchParams(''))
    expect(filters).toEqual(defaultFilters)
  })

  it('round-trips a non-default filter set through the URL', () => {
    const original: KlashFilters = {
      categories: ['category_1', 'category_3'],
      importances: ['high'],
      statuses: ['new', 'in_progress'],
      createdAfter: '2026-01-01',
    }
    const params = filtersToSearchParams(original)
    const filters = filtersFromSearchParams(params)
    expect(filters).toEqual(original)
  })

  it('ignores an unknown category value instead of crashing', () => {
    const filters = filtersFromSearchParams(
      new URLSearchParams('category=category_1,not-a-category'),
    )
    expect(filters.categories).toEqual(['category_1'])
  })

  it('falls back to the default category list when every value is unknown', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('category=bogus'))
    expect(filters.categories).toEqual(defaultFilters.categories)
  })

  it('ignores a malformed since date', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('since=not-a-date'))
    expect(filters.createdAfter).toBeNull()
  })

  it('accepts a well-formed since date', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('since=2026-03-15'))
    expect(filters.createdAfter).toBe('2026-03-15')
  })
})
