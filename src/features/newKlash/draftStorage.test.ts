import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearStoredDraft,
  hasStoredDraft,
  isDraftWorthKeeping,
  readStoredDraft,
  writeStoredDraft,
  type StoredKlashDraft,
} from './draftStorage'
import { emptyKlashFormDraft } from './newKlashSchemas'

const STORAGE_KEY = 'klash-draft'

function makeDraft(overrides: Partial<StoredKlashDraft> = {}): StoredKlashDraft {
  return {
    version: 1,
    // A fixed "now" (not a hardcoded past date, whose age against the real
    // clock would keep drifting) — every test that cares about age passes
    // an explicit `now` to readStoredDraft/hasStoredDraft instead of relying
    // on the real clock.
    savedAt: new Date().toISOString(),
    lat: 43.48,
    lng: -1.56,
    step: 'form',
    form: { ...emptyKlashFormDraft, title: 'Nid de poule' },
    photos: [],
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('readStoredDraft', () => {
  it('returns null when nothing is stored', () => {
    expect(readStoredDraft()).toBeNull()
  })

  it('round-trips a draft written by writeStoredDraft', () => {
    const draft = makeDraft()
    writeStoredDraft(draft)
    expect(readStoredDraft()).toEqual(draft)
  })

  it('returns null and purges invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(readStoredDraft()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('returns null and purges an unknown version', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...makeDraft(), version: 2 }))
    expect(readStoredDraft()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('returns null and purges a draft older than 7 days', () => {
    writeStoredDraft(makeDraft({ savedAt: '2026-09-08T12:00:00.000Z' }))
    const eightDaysLater = new Date('2026-09-16T13:00:00.000Z').getTime()
    expect(readStoredDraft(eightDaysLater)).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('keeps a draft saved just under 7 days ago', () => {
    writeStoredDraft(makeDraft({ savedAt: '2026-09-08T12:00:00.000Z' }))
    const almostSevenDaysLater = new Date('2026-09-15T11:00:00.000Z').getTime()
    expect(readStoredDraft(almostSevenDaysLater)).not.toBeNull()
  })

  it('returns null when localStorage throws', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readStoredDraft()).toBeNull()
    getItemSpy.mockRestore()
  })
})

describe('writeStoredDraft', () => {
  it('does not throw when localStorage throws', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => writeStoredDraft(makeDraft())).not.toThrow()
    setItemSpy.mockRestore()
  })
})

describe('clearStoredDraft', () => {
  it('removes a stored draft', () => {
    writeStoredDraft(makeDraft())
    clearStoredDraft()
    expect(readStoredDraft()).toBeNull()
  })

  it('does not throw when localStorage throws', () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => clearStoredDraft()).not.toThrow()
    removeItemSpy.mockRestore()
  })
})

describe('hasStoredDraft', () => {
  it('is false when nothing is stored', () => {
    expect(hasStoredDraft()).toBe(false)
  })

  it('is true for a fresh, valid draft', () => {
    writeStoredDraft(makeDraft())
    expect(hasStoredDraft()).toBe(true)
  })

  it('is false for an expired draft', () => {
    writeStoredDraft(makeDraft({ savedAt: '2026-09-08T12:00:00.000Z' }))
    const eightDaysLater = new Date('2026-09-16T13:00:00.000Z').getTime()
    expect(hasStoredDraft(eightDaysLater)).toBe(false)
  })
})

describe('isDraftWorthKeeping', () => {
  it('is false for the untouched empty form with no photos', () => {
    expect(isDraftWorthKeeping(emptyKlashFormDraft, 0)).toBe(false)
  })

  it('is true as soon as there is a photo, even with an empty form', () => {
    expect(isDraftWorthKeeping(emptyKlashFormDraft, 1)).toBe(true)
  })

  it('is true once a category is picked', () => {
    expect(isDraftWorthKeeping({ ...emptyKlashFormDraft, category: 'category_1' }, 0)).toBe(true)
  })

  it('is true once a title is typed', () => {
    expect(isDraftWorthKeeping({ ...emptyKlashFormDraft, title: 'a' }, 0)).toBe(true)
  })

  it('is true once a description is typed', () => {
    expect(isDraftWorthKeeping({ ...emptyKlashFormDraft, description: 'a' }, 0)).toBe(true)
  })

  it('is true once a proposed solution is typed', () => {
    expect(isDraftWorthKeeping({ ...emptyKlashFormDraft, proposedSolution: 'a' }, 0)).toBe(true)
  })

  it('is false for whitespace-only text', () => {
    expect(isDraftWorthKeeping({ ...emptyKlashFormDraft, title: '   ' }, 0)).toBe(false)
  })
})
