import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetTileFailoverForTests,
  __subscribeTileFailoverForTests,
  isTileFailedOver,
  reportTileError,
} from './tileFailover'

const STORAGE_KEY = 'tile-failover-until'

function okResponse(): Response {
  return { ok: true } as Response
}

function errorResponse(): Response {
  return { ok: false } as Response
}

beforeEach(() => {
  localStorage.clear()
  __resetTileFailoverForTests()
})

describe('reportTileError', () => {
  it('does nothing when the MapTiler tile actually loads fine on retry', async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse())
    await reportTileError('https://api.maptiler.com/maps/streets-v2/1/2/3.png', { fetch })
    expect(fetch).toHaveBeenCalledTimes(1) // only the MapTiler probe, no IGN confirmation needed
    expect(isTileFailedOver()).toBe(false)
  })

  it('cache-busts the probe URL so a service worker CacheFirst route cannot short-circuit it (regression: PR #33 review)', async () => {
    // `cache: 'no-store'` (the RequestInit option below) only ever governs the browser's
    // own HTTP cache — a service worker's Cache Storage (vite.config.ts's maptiler-tiles
    // CacheFirst route) intercepts by URL regardless of it. Without a cache-busting query
    // param, a tile cached as an opaque error response during a real outage would make
    // every future probe of that same URL "fail" forever, even once MapTiler recovers.
    const fetch = vi.fn().mockResolvedValue(okResponse())
    const tileUrl = 'https://api.maptiler.com/maps/streets-v2/1/2/3.png?key=abc'
    await reportTileError(tileUrl, { fetch })
    const [calledUrl, options] = fetch.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).not.toBe(tileUrl)
    expect(calledUrl).toMatch(
      /^https:\/\/api\.maptiler\.com\/maps\/streets-v2\/1\/2\/3\.png\?key=abc&_probe=\d+$/,
    )
    expect(options.cache).toBe('no-store')
  })

  it('fails over when MapTiler is unreachable but IGN answers (a real MapTiler outage)', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error')) // MapTiler probe
      .mockResolvedValueOnce(okResponse()) // IGN reference probe
    await reportTileError('https://api.maptiler.com/maps/streets-v2/1/2/3.png', { fetch })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(isTileFailedOver()).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('also fails over on a readable non-ok MapTiler status, confirmed via IGN', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(errorResponse()) // MapTiler probe: readable 4xx/5xx
      .mockResolvedValueOnce(okResponse()) // IGN reference probe
    await reportTileError('https://api.maptiler.com/maps/streets-v2/1/2/3.png', { fetch })
    expect(isTileFailedOver()).toBe(true)
  })

  it('does not fail over when both MapTiler and IGN are unreachable (this device is offline)', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('network error'))
    await reportTileError('https://api.maptiler.com/maps/streets-v2/1/2/3.png', {
      fetch,
      isOnline: () => true,
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(isTileFailedOver()).toBe(false)
  })

  it('never probes at all when navigator.onLine is false', async () => {
    const fetch = vi.fn()
    await reportTileError('https://api.maptiler.com/maps/streets-v2/1/2/3.png', {
      fetch,
      isOnline: () => false,
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(isTileFailedOver()).toBe(false)
  })

  it('never re-probes once already failed over', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(okResponse())
    await reportTileError('https://api.maptiler.com/maps/streets-v2/1/2/3.png', { fetch })
    expect(isTileFailedOver()).toBe(true)

    fetch.mockClear()
    await reportTileError('https://api.maptiler.com/maps/streets-v2/4/5/6.png', { fetch })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('dedupes concurrent probes from multiple tiles erroring at once', async () => {
    let resolveMaptilerProbe!: (value: Response) => void
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveMaptilerProbe = resolve
        }),
    )

    const first = reportTileError('https://api.maptiler.com/maps/streets-v2/1/2/3.png', { fetch })
    const second = reportTileError('https://api.maptiler.com/maps/streets-v2/4/5/6.png', { fetch })

    expect(fetch).toHaveBeenCalledTimes(1) // the second call's probe was skipped, not queued
    resolveMaptilerProbe(okResponse())
    await Promise.all([first, second])
    expect(isTileFailedOver()).toBe(false)
  })

  it('notifies subscribers when the failover window naturally expires (regression: PR #33 review, round 2)', async () => {
    // isTileFailedOver() flipping to false on its own (Date.now() alone guarantees
    // that) was never the bug — useSyncExternalStore only re-reads it on a subscriber
    // notification or an unrelated re-render, so the real regression this guards is
    // "does a subscriber actually get called", which only a real listener can catch.
    vi.useFakeTimers()
    try {
      const fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('network error')) // MapTiler probe
        .mockResolvedValueOnce(okResponse()) // IGN reference probe
      await reportTileError('https://api.maptiler.com/maps/streets-v2/1/2/3.png', { fetch })
      expect(isTileFailedOver()).toBe(true)

      const listener = vi.fn()
      const unsubscribe = __subscribeTileFailoverForTests(listener)

      vi.advanceTimersByTime(6 * 60 * 60 * 1000)

      expect(listener).toHaveBeenCalledTimes(1)
      expect(isTileFailedOver()).toBe(false)
      unsubscribe()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('a persisted failover survives a reload', () => {
  // The module reads localStorage once, at module init (`let failoverUntil =
  // readFailoverUntil()`) — mirroring what actually happens on a page reload, not what
  // setting localStorage mid-session does to an already-loaded module (it wouldn't do
  // anything, by design: see the module-level comment on why this is module state, not
  // component state). vi.resetModules() + a fresh dynamic import is what actually
  // exercises that init path.
  it('starts failed over when a future timestamp is already in localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + 60_000))
    vi.resetModules()
    const fresh = await import('./tileFailover')
    expect(fresh.isTileFailedOver()).toBe(true)
    // Module init also arms a real 60s expiry timer (scheduleExpiryNotification) on
    // this fresh instance — clear it rather than leaving it pending past this test.
    fresh.__resetTileFailoverForTests()
  })

  it('starts not failed over when the persisted timestamp has already expired', async () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() - 1000))
    vi.resetModules()
    const fresh = await import('./tileFailover')
    expect(fresh.isTileFailedOver()).toBe(false)
  })
})
