import { describe, expect, it } from 'vitest'
import {
  adminParamsFromSearchParams,
  adminSortOrder,
  adminParamsToSearchParams,
  adminTabFromSearchParams,
  adminTabToSearchParams,
  defaultAdminTableParams,
  nextSortOnHeaderClick,
  type AdminTableParams,
} from './adminFilterParams'

describe('adminParamsToSearchParams', () => {
  it('produces no filter params for the default params', () => {
    const params = adminParamsToSearchParams(new URLSearchParams(), defaultAdminTableParams)
    expect(params.toString()).toBe('')
  })

  it('writes only the fields that differ from the default', () => {
    const custom: AdminTableParams = { ...defaultAdminTableParams, status: 'new' }
    const params = adminParamsToSearchParams(new URLSearchParams(), custom)
    expect(params.get('status')).toBe('new')
    expect(params.has('category')).toBe(false)
    expect(params.has('period')).toBe(false)
    expect(params.has('q')).toBe(false)
    expect(params.has('sort')).toBe(false)
    expect(params.has('dir')).toBe(false)
    expect(params.has('page')).toBe(false)
  })

  it('writes the sort column and direction independently, each only when non-default', () => {
    const column = adminParamsToSearchParams(new URLSearchParams(), {
      ...defaultAdminTableParams,
      sort: 'confirmations',
    })
    expect(column.get('sort')).toBe('confirmations')
    expect(column.has('dir')).toBe(false)

    const direction = adminParamsToSearchParams(new URLSearchParams(), {
      ...defaultAdminTableParams,
      direction: 'asc',
    })
    expect(direction.has('sort')).toBe(false)
    expect(direction.get('dir')).toBe('asc')
  })

  it('writes the page as 1-based', () => {
    const custom: AdminTableParams = { ...defaultAdminTableParams, page: 2 }
    const params = adminParamsToSearchParams(new URLSearchParams(), custom)
    expect(params.get('page')).toBe('3')
  })

  it('preserves an unrelated param already on the URL (e.g. tab)', () => {
    const current = new URLSearchParams('tab=triage')
    const custom: AdminTableParams = { ...defaultAdminTableParams, status: 'new' }
    const params = adminParamsToSearchParams(current, custom)
    expect(params.get('tab')).toBe('triage')
    expect(params.get('status')).toBe('new')
  })

  it('clears a previously-set field back to its default', () => {
    const current = new URLSearchParams('status=new&q=nid')
    const params = adminParamsToSearchParams(current, defaultAdminTableParams)
    expect(params.has('status')).toBe(false)
    expect(params.has('q')).toBe(false)
  })

  it('clears a previously-set sort back to the default', () => {
    const current = new URLSearchParams('sort=comments&dir=asc&tab=triage')
    const params = adminParamsToSearchParams(current, defaultAdminTableParams)
    expect(params.has('sort')).toBe(false)
    expect(params.has('dir')).toBe(false)
    expect(params.get('tab')).toBe('triage')
  })
})

describe('adminParamsFromSearchParams', () => {
  it('returns the defaults for an empty URL', () => {
    expect(adminParamsFromSearchParams(new URLSearchParams(''))).toEqual(defaultAdminTableParams)
  })

  it('round-trips a non-default param set through the URL', () => {
    const original: AdminTableParams = {
      status: 'new',
      category: 'category_2',
      period: '30',
      searchText: 'nid de poule',
      sort: 'comments',
      direction: 'asc',
      page: 2,
    }
    const params = adminParamsToSearchParams(new URLSearchParams(), original)
    expect(adminParamsFromSearchParams(params)).toEqual(original)
  })

  it('falls back to defaults for unknown status/category/period', () => {
    const params = new URLSearchParams('status=bogus&category=inconnue&period=42')
    expect(adminParamsFromSearchParams(params)).toEqual(defaultAdminTableParams)
  })

  it('falls back to the default sort for an unknown column or direction', () => {
    expect(adminParamsFromSearchParams(new URLSearchParams('sort=bogus&dir=sideways'))).toEqual(
      defaultAdminTableParams,
    )
  })

  it('keeps a valid sort field when the other one is invalid', () => {
    const column = adminParamsFromSearchParams(new URLSearchParams('sort=comments&dir=sideways'))
    expect(column.sort).toBe('comments')
    expect(column.direction).toBe('desc')
    const direction = adminParamsFromSearchParams(new URLSearchParams('sort=bogus&dir=asc'))
    expect(direction.sort).toBe('created')
    expect(direction.direction).toBe('asc')
  })

  it('falls back to page 0 for a non-numeric or out-of-range page', () => {
    expect(adminParamsFromSearchParams(new URLSearchParams('page=abc')).page).toBe(0)
    expect(adminParamsFromSearchParams(new URLSearchParams('page=0')).page).toBe(0)
    expect(adminParamsFromSearchParams(new URLSearchParams('page=-3')).page).toBe(0)
  })

  it('rejects a page value with trailing junk instead of parsing its numeric prefix', () => {
    // Number.parseInt would read "2abc" as 2 and "1e3" as 1 (not 1000) —
    // both must fall back to the default instead of silently misreading a
    // malformed URL.
    expect(adminParamsFromSearchParams(new URLSearchParams('page=2abc')).page).toBe(0)
    expect(adminParamsFromSearchParams(new URLSearchParams('page=1e3')).page).toBe(0)
  })

  it('ignores unrelated params (e.g. tab)', () => {
    const params = adminParamsFromSearchParams(new URLSearchParams('tab=roles&status=new'))
    expect(params.status).toBe('new')
  })
})

describe('adminTabFromSearchParams / adminTabToSearchParams', () => {
  it('defaults to klashes for an empty or unknown tab', () => {
    expect(adminTabFromSearchParams(new URLSearchParams(''))).toBe('klashes')
    expect(adminTabFromSearchParams(new URLSearchParams('tab=bogus'))).toBe('klashes')
  })

  it('round-trips a non-default tab through the URL', () => {
    const params = adminTabToSearchParams(new URLSearchParams(), 'triage')
    expect(adminTabFromSearchParams(params)).toBe('triage')
  })

  it('omits the default tab from the URL', () => {
    const params = adminTabToSearchParams(new URLSearchParams(), 'klashes')
    expect(params.has('tab')).toBe(false)
  })

  it('preserves table filter params already on the URL', () => {
    const current = new URLSearchParams('status=new&q=nid')
    const params = adminTabToSearchParams(current, 'triage')
    expect(params.get('status')).toBe('new')
    expect(params.get('q')).toBe('nid')
    expect(params.get('tab')).toBe('triage')
  })
})

describe('nextSortOnHeaderClick', () => {
  it('sorts a newly-clicked column descending first', () => {
    expect(nextSortOnHeaderClick({ sort: 'created', direction: 'asc' }, 'comments')).toEqual({
      sort: 'comments',
      direction: 'desc',
    })
  })

  it('flips the direction of the active column', () => {
    const desc = { sort: 'confirmations', direction: 'desc' } as const
    const asc = nextSortOnHeaderClick(desc, 'confirmations')
    expect(asc).toEqual({ sort: 'confirmations', direction: 'asc' })
    expect(nextSortOnHeaderClick(asc, 'confirmations')).toEqual(desc)
  })
})

describe('adminSortOrder', () => {
  it('orders by the chosen column, then newest first, then id', () => {
    expect(adminSortOrder({ sort: 'confirmations', direction: 'asc' })).toEqual([
      ['confirmations_count', true],
      ['created_at', false],
      ['id', false],
    ])
    expect(adminSortOrder({ sort: 'comments', direction: 'desc' })).toEqual([
      ['comments_count', false],
      ['created_at', false],
      ['id', false],
    ])
  })

  it('breaks date ties by id in the same direction', () => {
    expect(adminSortOrder({ sort: 'created', direction: 'desc' })).toEqual([
      ['created_at', false],
      ['id', false],
    ])
    expect(adminSortOrder({ sort: 'created', direction: 'asc' })).toEqual([
      ['created_at', true],
      ['id', true],
    ])
  })

  it.each(['created', 'confirmations', 'comments'] as const)(
    'ends with the unique id key for %s',
    (sort) => {
      for (const direction of ['asc', 'desc'] as const) {
        const order = adminSortOrder({ sort, direction })
        expect(order[order.length - 1][0]).toBe('id')
      }
    },
  )
})
