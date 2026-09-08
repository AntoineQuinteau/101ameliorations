/**
 * Sanitizes the `?next=` redirect target used by `/login`. Without this, an
 * attacker-crafted `/login?next=https://evil.example` would be an open
 * redirect once the user authenticates. Anything that isn't an in-app,
 * root-relative path falls back to the map.
 */
export function safeNextPath(next: string | null): string {
  if (!next) return '/'
  if (!next.startsWith('/')) return '/' // absolute URLs, javascript:, mailto:, etc.
  if (next.startsWith('//')) return '/' // protocol-relative -> external host
  return next
}
