import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetTileFailoverForTests, isTileFailedOver, reportTileError } from './tileFailover'

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
  })

  it('starts not failed over when the persisted timestamp has already expired', async () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() - 1000))
    vi.resetModules()
    const fresh = await import('./tileFailover')
    expect(fresh.isTileFailedOver()).toBe(false)
  })
})
