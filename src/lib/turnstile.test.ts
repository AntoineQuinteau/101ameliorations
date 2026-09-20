import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTurnstile } from './turnstile'

/** The module caches its load promise across calls, so each test needs a
 * fresh copy to start from "script not yet injected". */
async function freshLoadTurnstile() {
  vi.resetModules()
  const module = await import('./turnstile')
  return module.loadTurnstile
}

function injectedScript(): HTMLScriptElement {
  const script = document.head.querySelector('script[src*="challenges.cloudflare.com"]')
  if (!script) throw new Error('no Turnstile script was injected')
  return script as HTMLScriptElement
}

const fakeApi = { render: vi.fn(), execute: vi.fn(), reset: vi.fn(), remove: vi.fn() }

beforeEach(() => {
  vi.useFakeTimers()
  document.head.innerHTML = ''
  delete window.turnstile
})

afterEach(() => {
  vi.useRealTimers()
})

describe('loadTurnstile', () => {
  it('resolves with the API once the script loads', async () => {
    const load = await freshLoadTurnstile()
    const promise = load()
    window.turnstile = fakeApi
    injectedScript().onload?.(new Event('load'))
    await expect(promise).resolves.toBe(fakeApi)
  })

  it('shares one script and one promise between concurrent callers', async () => {
    const load = await freshLoadTurnstile()
    const first = load()
    const second = load()
    expect(document.head.querySelectorAll('script').length).toBe(1)
    window.turnstile = fakeApi
    injectedScript().onload?.(new Event('load'))
    await expect(first).resolves.toBe(fakeApi)
    await expect(second).resolves.toBe(fakeApi)
  })

  it('rejects rather than hanging when the script neither loads nor errors', async () => {
    // The blocked-by-an-extension / stalled-network case: no onload, no
    // onerror, which used to leave every caller pending for good.
    const load = await freshLoadTurnstile()
    const promise = load()
    const assertion = expect(promise).rejects.toThrow(/Timed out/)
    await vi.advanceTimersByTimeAsync(10_000)
    await assertion
  })

  it('rejects when the script errors outright', async () => {
    const load = await freshLoadTurnstile()
    const promise = load()
    injectedScript().onerror?.(new Event('error'))
    await expect(promise).rejects.toThrow(/Failed to load/)
  })

  it('lets a later call retry after a failure instead of replaying it', async () => {
    const load = await freshLoadTurnstile()
    const first = load()
    injectedScript().onerror?.(new Event('error'))
    await expect(first).rejects.toThrow()

    document.head.innerHTML = ''
    const second = load()
    window.turnstile = fakeApi
    injectedScript().onload?.(new Event('load'))
    await expect(second).resolves.toBe(fakeApi)
  })

  it('does not inject a script when the API is already present', async () => {
    window.turnstile = fakeApi
    const load = await freshLoadTurnstile()
    await expect(load()).resolves.toBe(fakeApi)
    expect(document.head.querySelectorAll('script').length).toBe(0)
  })

  it('is exported as a callable from the module entry point', () => {
    expect(typeof loadTurnstile).toBe('function')
  })
})
