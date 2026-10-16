import { describe, expect, it } from 'vitest'
import { filtersFromSearchParams, filtersToSearchParams } from './filterParams'
import { defaultFilters, type KlashFilters } from './klashFilters'

describe('filtersToSearchParams', () => {
  it('produces no params for the default filters', () => {
    const params = filtersToSearchParams(defaultFilters)
    expect(params.toString()).toBe('')
  })

  it('writes only the dimensions that narrow something', () => {
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
      period: '30d',
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

  it('falls back to no category restriction when every value is unknown', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('category=bogus'))
    expect(filters.categories).toEqual([])
  })

  it('drops the statuses the map never shows', () => {
    const filters = filtersFromSearchParams(
      new URLSearchParams('status=new,rejected,duplicate,resolved'),
    )
    expect(filters.statuses).toEqual(['new', 'resolved'])
  })

  it('ignores an unknown period', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('since=12d'))
    expect(filters.period).toBeNull()
  })

  it('ignores a since in the legacy absolute-date form', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('since=2026-03-15'))
    expect(filters.period).toBeNull()
  })

  it('accepts a period preset', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('since=7d'))
    expect(filters.period).toBe('7d')
  })
})
