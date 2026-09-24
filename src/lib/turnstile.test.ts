import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTurnstile, requestTurnstileToken, type TurnstileRenderOptions } from './turnstile'

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

describe('requestTurnstileToken', () => {
  /** A fake API whose `render` hands the test the callbacks it was given. */
  function fakeWidgetApi() {
    let options: TurnstileRenderOptions | undefined
    const api = {
      render: vi.fn((_container: HTMLElement, renderOptions: TurnstileRenderOptions) => {
        options = renderOptions
        return 'widget-1'
      }),
      execute: vi.fn(),
      reset: vi.fn(),
      remove: vi.fn(),
    }
    return { api, callbacks: () => options! }
  }

  function request(
    api: Parameters<typeof requestTurnstileToken>[0],
    previousWidgetId = null as string | null,
  ) {
    const onInteractiveChange = vi.fn()
    const onRendered = vi.fn()
    const promise = requestTurnstileToken(api, document.createElement('div'), {
      siteKey: 'site-key',
      previousWidgetId,
      onRendered,
      onInteractiveChange,
      timeoutMs: 30_000,
    })
    return { promise, onInteractiveChange, onRendered }
  }

  it('resolves the token and executes the freshly rendered widget', async () => {
    const { api, callbacks } = fakeWidgetApi()
    const { promise, onRendered } = request(api)
    expect(api.execute).toHaveBeenCalledOnce()
    expect(onRendered).toHaveBeenCalledWith('widget-1')
    callbacks().callback('token-123')
    await expect(promise).resolves.toEqual({ ok: true, token: 'token-123' })
  })

  it("keeps Cloudflare's error code (e.g. 110200, hostname not allowed)", async () => {
    const { api, callbacks } = fakeWidgetApi()
    const { promise } = request(api)
    expect(callbacks()['error-callback']?.('110200')).toBe(true)
    await expect(promise).resolves.toEqual({
      ok: false,
      reason: 'widget-error',
      errorCode: '110200',
    })
  })

  it('reports expiry and challenge timeout distinctly', async () => {
    const expired = fakeWidgetApi()
    const first = request(expired.api)
    expired.callbacks()['expired-callback']?.()
    await expect(first.promise).resolves.toEqual({ ok: false, reason: 'expired' })

    const timedOut = fakeWidgetApi()
    const second = request(timedOut.api)
    timedOut.callbacks()['timeout-callback']?.()
    await expect(second.promise).resolves.toEqual({ ok: false, reason: 'challenge-timeout' })
  })

  it('gives up with no-response when Turnstile never calls back', async () => {
    const { api } = fakeWidgetApi()
    const { promise, onInteractiveChange } = request(api)
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(promise).resolves.toEqual({ ok: false, reason: 'no-response' })
    expect(onInteractiveChange).toHaveBeenLastCalledWith(false)
  })

  it('resolves render-threw instead of rejecting when render throws', async () => {
    const { api } = fakeWidgetApi()
    api.render.mockImplementation(() => {
      throw new Error('invalid sitekey')
    })
    await expect(request(api).promise).resolves.toEqual({ ok: false, reason: 'render-threw' })
  })

  it('removes the previous widget before rendering a new one', () => {
    const { api } = fakeWidgetApi()
    request(api, 'old-widget')
    expect(api.remove).toHaveBeenCalledWith('old-widget')
  })

  it('shows the challenge slot only between before-interactive and settle', async () => {
    const { api, callbacks } = fakeWidgetApi()
    const { promise, onInteractiveChange } = request(api)
    callbacks()['before-interactive-callback']?.()
    expect(onInteractiveChange).toHaveBeenLastCalledWith(true)
    callbacks().callback('token')
    await promise
    expect(onInteractiveChange).toHaveBeenLastCalledWith(false)
  })
})
