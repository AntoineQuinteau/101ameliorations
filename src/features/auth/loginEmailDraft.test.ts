import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearLoginEmailDraft, readLoginEmailDraft, writeLoginEmailDraft } from './loginEmailDraft'

describe('loginEmailDraft', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns an empty string when nothing was stored', () => {
    expect(readLoginEmailDraft()).toBe('')
  })

  it('round-trips the email through sessionStorage only', () => {
    writeLoginEmailDraft('alice@example.org')
    expect(readLoginEmailDraft()).toBe('alice@example.org')
    expect(localStorage.length).toBe(0)
  })

  it('removes the entry when written empty or cleared', () => {
    writeLoginEmailDraft('alice@example.org')
    writeLoginEmailDraft('')
    expect(sessionStorage.length).toBe(0)

    writeLoginEmailDraft('alice@example.org')
    clearLoginEmailDraft()
    expect(readLoginEmailDraft()).toBe('')
    expect(sessionStorage.length).toBe(0)
  })

  it('degrades silently when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readLoginEmailDraft()).toBe('')
    expect(() => writeLoginEmailDraft('alice@example.org')).not.toThrow()
  })
})
