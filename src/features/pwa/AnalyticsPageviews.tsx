import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { initAnalytics, trackPageview } from '../../lib/analytics'
import { landingPageviewUrl } from '../../lib/landingPageviewUrl'
import { landingSearch } from '../attribution/captureOnLoad'

// Admin screens are staff tooling, not audience.
const UNTRACKED_PREFIXES = ['/admin']

/** Sends one Umami pageview per route. The first carries the arrival URL with
 * its utm_* (already stripped from the address bar by the time React runs);
 * later ones are the path only, never the query: `/new?lat=…&lng=…` holds a
 * position the visitor is about to report. */
export function AnalyticsPageviews() {
  const { pathname } = useLocation()
  const isFirst = useRef(true)

  useEffect(() => {
    initAnalytics()
    if (UNTRACKED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return
    if (isFirst.current) {
      isFirst.current = false
      trackPageview(landingPageviewUrl(pathname, landingSearch), document.referrer)
    } else {
      trackPageview(pathname)
    }
  }, [pathname])

  return null
}
