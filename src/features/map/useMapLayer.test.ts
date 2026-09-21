import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readStoredMapLayer, writeStoredMapLayer } from './useMapLayer'

const STORAGE_KEY = 'map-layer'

beforeEach(() => {
  localStorage.clear()
})

describe('readStoredMapLayer', () => {
  it('defaults to plan when nothing is stored', () => {
    expect(readStoredMapLayer()).toBe('plan')
  })

  it('round-trips a value written by writeStoredMapLayer', () => {
    writeStoredMapLayer('satellite')
    expect(readStoredMapLayer()).toBe('satellite')
  })

  it('falls back to plan on an invalid stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'space')
    expect(readStoredMapLayer()).toBe('plan')
  })

  it('falls back to plan when localStorage throws', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readStoredMapLayer()).toBe('plan')
    getItemSpy.mockRestore()
  })
})

describe('writeStoredMapLayer', () => {
  it('does not throw when localStorage throws', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => writeStoredMapLayer('satellite')).not.toThrow()
    setItemSpy.mockRestore()
  })
})
