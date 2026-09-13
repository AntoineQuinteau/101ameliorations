import { describe, expect, it } from 'vitest'
import { createSubmitGuard } from './submitGuard'

describe('createSubmitGuard', () => {
  it('lets the first caller through', () => {
    const guard = createSubmitGuard()
    expect(guard.claim()).toBe(true)
  })

  it('turns away every caller after the first', () => {
    const guard = createSubmitGuard()
    guard.claim()
    expect(guard.claim()).toBe(false)
    expect(guard.claim()).toBe(false)
  })

  // The StrictMode case: the effect body runs twice with no render in
  // between, so a useState flag would still read false on the second pass.
  // Claiming is synchronous, so the second call is already refused.
  it('refuses a second claim made synchronously, with no re-render in between', () => {
    const guard = createSubmitGuard()
    const outcomes = [guard.claim(), guard.claim()]
    expect(outcomes).toEqual([true, false])
  })

  // The two-callers case: SubmitStep's onReady effect and NewKlashPage's
  // direct call both reaching for the same action.
  it('admits exactly one of many concurrent callers', () => {
    const guard = createSubmitGuard()
    const admitted = [1, 2, 3, 4, 5].filter(() => guard.claim())
    expect(admitted).toHaveLength(1)
  })

  it('reports whether the slot is taken', () => {
    const guard = createSubmitGuard()
    expect(guard.isClaimed).toBe(false)
    guard.claim()
    expect(guard.isClaimed).toBe(true)
  })

  it('allows a retry after a failed submit releases the slot', () => {
    const guard = createSubmitGuard()
    guard.claim()
    guard.release()
    expect(guard.isClaimed).toBe(false)
    expect(guard.claim()).toBe(true)
  })

  it('re-locks after a released slot is re-claimed', () => {
    const guard = createSubmitGuard()
    guard.claim()
    guard.release()
    guard.claim()
    expect(guard.claim()).toBe(false)
  })
})
