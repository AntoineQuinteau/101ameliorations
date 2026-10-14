import { afterEach, describe, expect, it } from 'vitest'
import { hasPreviousInAppEntry } from './inAppHistory'

afterEach(() => {
  window.history.replaceState(null, '')
})

describe('hasPreviousInAppEntry', () => {
  it('is false on the first entry of the tab', () => {
    window.history.replaceState({ idx: 0 }, '')
    expect(hasPreviousInAppEntry()).toBe(false)
  })

  it('is true once the app has navigated', () => {
    window.history.replaceState({ idx: 1 }, '')
    expect(hasPreviousInAppEntry()).toBe(true)
  })

  it('is false when the state has no idx', () => {
    window.history.replaceState({}, '')
    expect(hasPreviousInAppEntry()).toBe(false)
    window.history.replaceState(null, '')
    expect(hasPreviousInAppEntry()).toBe(false)
  })
})
