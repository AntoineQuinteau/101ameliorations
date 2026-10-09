import { applyArrival, attributionFromLaunchParams, cleanedSearch } from './attribution'
import { readAttribution, writeAttribution } from './attributionStorage'
import { syncIosManifest } from './iosManifest'

// Imported first by src/main.tsx on purpose: this runs as a side effect of the
// import, before router.tsx (and so createBrowserRouter) reads the address
// bar, so the router only ever sees the cleaned URL.
export function captureAttribution(): void {
  const { search, pathname, hostname, hash } = window.location
  const now = new Date()

  // An installed iOS app starts with empty storage (separate from Safari's):
  // restore what the manifest's start_url carried, but only into that empty
  // storage — never over an existing attribution.
  const stored = readAttribution() ?? attributionFromLaunchParams(search, now)

  const next = applyArrival(stored, {
    search,
    pathname,
    hostname,
    referrer: document.referrer,
    now,
  })
  writeAttribution(next)
  syncIosManifest(next)

  const cleaned = cleanedSearch(search)
  if (cleaned !== null) {
    window.history.replaceState(window.history.state, '', `${pathname}${cleaned}${hash}`)
  }
}

captureAttribution()
