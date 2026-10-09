import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readWelcomeSeen,
  shouldAutoShowWelcome,
  WELCOME_SEEN_KEY,
  writeWelcomeSeen,
} from './welcomeStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('readWelcomeSeen', () => {
  it('is false when nothing is stored', () => {
    expect(readWelcomeSeen()).toBe(false)
  })

  it('round-trips a value written by writeWelcomeSeen', () => {
    writeWelcomeSeen()
    expect(readWelcomeSeen()).toBe(true)
  })

  it('ignores any value other than 1', () => {
    localStorage.setItem(WELCOME_SEEN_KEY, 'yes')
    expect(readWelcomeSeen()).toBe(false)
  })

  it('is false when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readWelcomeSeen()).toBe(false)
    spy.mockRestore()
  })
})

describe('writeWelcomeSeen', () => {
  it('does not throw when localStorage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => writeWelcomeSeen()).not.toThrow()
    spy.mockRestore()
  })
})

describe('shouldAutoShowWelcome', () => {
  const base = { seen: false, isInitializing: false, isSignedIn: false }

  it('shows for a signed-out visitor who has not seen it', () => {
    expect(shouldAutoShowWelcome(base)).toBe(true)
  })

  it('does not show once seen', () => {
    expect(shouldAutoShowWelcome({ ...base, seen: true })).toBe(false)
  })

  it('does not show to a signed-in user', () => {
    expect(shouldAutoShowWelcome({ ...base, isSignedIn: true })).toBe(false)
  })

  it('waits for auth to initialize', () => {
    expect(shouldAutoShowWelcome({ ...base, isInitializing: true })).toBe(false)
  })
})
