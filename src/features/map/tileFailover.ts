import { useSyncExternalStore } from 'react'
import { reportTileFailover } from '../../lib/sentry'

const STORAGE_KEY = 'tile-failover-until'
const FAILOVER_DURATION_MS = 6 * 60 * 60 * 1000
const PROBE_TIMEOUT_MS = 5000

// A stable, independent host to confirm a real MapTiler outage rather than this one
// device being offline — Géoplateforme's own GetCapabilities endpoint (its documented
// URL shape, not a tile: cheap, and it doesn't depend on this app's own tile-coordinate
// math being right). Deliberately not the actual failing MapTiler tile itself: a
// same-tile retry would just repeat whatever went wrong the first time (quota
// exhausted, key revoked, an outage) rather than distinguishing it from "no network".
const INTERNET_REFERENCE_URL =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities'

function readFailoverUntil(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? Number(raw) : 0
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    // Safari private browsing throws on read — treat as "not failed over" rather than
    // blocking the map.
    return 0
  }
}

function writeFailoverUntil(until: number): void {
  try {
    if (until > 0) localStorage.setItem(STORAGE_KEY, String(until))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Losing the persisted override for this session is fine — the in-memory
    // `failoverUntil` below still holds it until the next reload.
  }
}

// Module-level, not component state: MapTiles.tsx mounts up to three <MapTiles>
// instances at once (main map, mini map, new-klash map — see MapPage.tsx,
// KlashMiniMap.tsx, NewKlashPage.tsx) and they must all fail over together, from
// whichever one's tile happens to error first.
let failoverUntil = readFailoverUntil()
let isProbing = false
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

/** Exported (alongside `reportTileError`) as a pure function so `tileFailover.test.ts`
 * can assert on it directly, on the same model as `useMapLayer.ts`'s
 * `readStoredMapLayer` — this project has no `@testing-library/react`, so the
 * `useTileFailover` hook itself can't be rendered in a test. */
export function isTileFailedOver(now = Date.now()): boolean {
  return now < failoverUntil
}

function triggerFailover(reason: string): void {
  failoverUntil = Date.now() + FAILOVER_DURATION_MS
  writeFailoverUntil(failoverUntil)
  reportTileFailover(reason)
  notify()
}

async function probe(doFetch: typeof fetch, url: string): Promise<boolean> {
  try {
    const response = await doFetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    // A cross-origin fetch() (unlike the <img> tags TileLayer actually uses) needs a
    // matching CORS header to resolve at all — most APIs, MapTiler included, don't
    // reliably send one on an error response even when they do on success. So a real
    // quota/outage failure usually surfaces here as a thrown TypeError, not a readable
    // 4xx/5xx: this branch, not a readable non-ok status, is the expected path for the
    // failure this function exists to catch.
    return false
  }
}

/** Called from `MapTiles.tsx`'s `tileerror` handler, on a MapTiler layer only (never on
 * IGN or CyclOSM — see `MapTiles.tsx`). Confirms the failure is MapTiler itself being
 * down (quota exhausted, an outage) rather than this one device being offline, before
 * switching this device to IGN for `FAILOVER_DURATION_MS`. Deps are injectable so
 * `tileFailover.test.ts` can simulate every branch without real network access. */
export async function reportTileError(
  tileUrl: string,
  deps: { fetch?: typeof fetch; isOnline?: () => boolean } = {},
): Promise<void> {
  const doFetch = deps.fetch ?? fetch
  const isOnline = deps.isOnline ?? (() => navigator.onLine)

  // Already on the fallback, a probe is already in flight (many tiles typically error
  // together, right after the one that triggers this), or this device has no network at
  // all (nothing to distinguish — the service worker's own tile cache from
  // vite.config.ts is what takes over here, not a source switch).
  if (isTileFailedOver() || isProbing || !isOnline()) return

  isProbing = true
  try {
    const maptilerOk = await probe(doFetch, tileUrl)
    if (maptilerOk) return // a one-off tileerror on an otherwise-healthy MapTiler

    const ignReachable = await probe(doFetch, INTERNET_REFERENCE_URL)
    if (ignReachable) triggerFailover(`tileerror on ${tileUrl}, IGN reachable`)
  } finally {
    isProbing = false
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): boolean {
  return isTileFailedOver()
}

/** Whether this device is currently on the IGN fallback because of a detected MapTiler
 * failure (as opposed to an admin-forced `settings.tile_provider = 'ign'`, which
 * `useTileProviderSetting` covers separately — see `useTileProvider.ts`, which combines
 * both). */
export function useTileFailover(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Test-only: resets the module-level store between Vitest cases — `localStorage.clear()`
 * alone doesn't reset the in-memory `failoverUntil` mirror this module keeps. */
export function __resetTileFailoverForTests(): void {
  failoverUntil = 0
  isProbing = false
  writeFailoverUntil(0)
}
