import { describe, expect, it } from 'vitest'
import {
  adminParamsFromSearchParams,
  adminParamsToSearchParams,
  adminTabFromSearchParams,
  adminTabToSearchParams,
  defaultAdminTableParams,
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
    expect(params.has('page')).toBe(false)
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
      page: 2,
    }
    const params = adminParamsToSearchParams(new URLSearchParams(), original)
    expect(adminParamsFromSearchParams(params)).toEqual(original)
  })

  it('falls back to defaults for unknown status/category/period', () => {
    const params = new URLSearchParams('status=bogus&category=inconnue&period=42')
    expect(adminParamsFromSearchParams(params)).toEqual(defaultAdminTableParams)
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
