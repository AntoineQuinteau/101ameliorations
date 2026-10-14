import { describe, expect, it, vi } from 'vitest'
import { pushEscapeHandler } from './useEscapeKey'

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

describe('pushEscapeHandler', () => {
  it('runs only the most recently registered handler', () => {
    const lower = vi.fn()
    const upper = vi.fn()
    const unregisterLower = pushEscapeHandler(lower)
    const unregisterUpper = pushEscapeHandler(upper)

    press('Escape')
    expect(upper).toHaveBeenCalledTimes(1)
    expect(lower).not.toHaveBeenCalled()

    unregisterUpper()
    press('Escape')
    expect(lower).toHaveBeenCalledTimes(1)
    unregisterLower()
  })

  it('ignores other keys and does nothing once all are unregistered', () => {
    const handler = vi.fn()
    const unregister = pushEscapeHandler(handler)
    press('Enter')
    expect(handler).not.toHaveBeenCalled()
    unregister()
    press('Escape')
    expect(handler).not.toHaveBeenCalled()
  })
})
