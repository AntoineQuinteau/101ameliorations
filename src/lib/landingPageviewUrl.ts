// Kept apart from analytics.ts so it can be unit-tested without src/env.ts
// (which validates the build environment at import time).

/** The URL of the arrival pageview: the path and query as the visitor landed
 * (so Umami can read utm_* from it), minus the hash and the iOS launch
 * parameters that only carry the attribution to restore. */
export function landingPageviewUrl(pathname: string, search: string): string {
  const params = new URLSearchParams(search)
  for (const key of ['ft', 'lt', 'fs']) params.delete(key)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
