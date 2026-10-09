import { applyArrival, cleanedSearch } from './attribution'
import { readAttribution, writeAttribution } from './attributionStorage'

// Imported first by src/main.tsx on purpose: this runs as a side effect of the
// import, before router.tsx (and so createBrowserRouter) reads the address
// bar, so the router only ever sees the cleaned URL.
export function captureAttribution(): void {
  const { search, pathname, hostname, hash } = window.location

  writeAttribution(
    applyArrival(readAttribution(), {
      search,
      pathname,
      hostname,
      referrer: document.referrer,
      now: new Date(),
    }),
  )

  const cleaned = cleanedSearch(search)
  if (cleaned !== null) {
    window.history.replaceState(window.history.state, '', `${pathname}${cleaned}${hash}`)
  }
}

captureAttribution()
