// /ios-manifest.webmanifest — the web app manifest with an attribution-bearing
// start_url, for iOS only (the client points <link rel="manifest"> here on
// iOS Safari, see src/features/attribution/iosManifest.ts).
//
// Why: an iOS home-screen app gets storage separate from Safari's, so a visitor
// who installs before signing up would arrive in the app with no attribution.
// Embedding it in start_url lets the app restore it on first launch.
//
// The parameters are client-supplied: each one is re-validated here (same
// convention as the database) and anything that fails is simply dropped. With
// no valid parameter the static manifest is returned unchanged.

import type { Env } from './index'

const MANIFEST_PATH = '/ios-manifest.webmanifest'
const STATIC_MANIFEST_PATH = '/manifest.webmanifest'

const TOKEN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const HOST = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/
const MEDIUMS = new Set(['social', 'email', 'print', 'press'])

/** `source_medium_campaign_content_referrerHost`, empty parts allowed, or null
 * when the value is malformed or carries neither a source nor a host. */
function validTouch(raw: string | null): string | null {
  if (!raw || raw.length > 400) return null
  const parts = raw.split('_')
  if (parts.length !== 5) return null
  const [source, medium, campaign, content, host] = parts
  const tokenOk = (v: string) => v === '' || (v.length <= 64 && TOKEN.test(v))
  if (!tokenOk(source) || !tokenOk(campaign) || !tokenOk(content)) return null
  if (medium !== '' && !MEDIUMS.has(medium)) return null
  if (host !== '' && !HOST.test(host)) return null
  return source !== '' || host !== '' ? raw : null
}

function validTimestamp(raw: string | null): string | null {
  return raw && raw.length <= 40 && !Number.isNaN(Date.parse(raw)) ? raw : null
}

export async function handleIosManifest(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.pathname !== MANIFEST_PATH) return null

  const staticResponse = await env.ASSETS.fetch(new URL(STATIC_MANIFEST_PATH, url))
  if (!staticResponse.ok) return staticResponse

  const manifest = await staticResponse.json<Record<string, unknown>>()
  const startParams = new URLSearchParams({ launch: 'pwa' })
  const first = validTouch(url.searchParams.get('ft'))
  const last = validTouch(url.searchParams.get('lt'))
  if (first) startParams.set('ft', first)
  if (last) startParams.set('lt', last)
  const seen = validTimestamp(url.searchParams.get('fs'))
  if ((first || last) && seen) startParams.set('fs', seen)

  const body = first || last ? { ...manifest, start_url: `/?${startParams.toString()}` } : manifest
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
