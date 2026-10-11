// /r/:slug — campaign short links. Resolves the slug through the
// resolve_campaign_link() RPC (anon-callable, see
// supabase/migrations/20261009090000_campaign_links.sql) and answers with a
// 302 to the link's destination carrying its utm_* parameters.
//
// Same rule as the Open Graph rewrite: never a point of failure. An unknown
// or deactivated slug, a malformed one, a Supabase outage or a timeout all
// end in a plain redirect to the home page with no parameters.

import type { Env } from './index'

const SLUG_PATH_PATTERN = /^\/r\/([^/]+)\/?$/
const FETCH_TIMEOUT_MS = 1500

// Link-preview fetchers (chat apps, social networks) and crawlers hit a link
// when it is pasted, not when a person follows it: redirecting them is right,
// counting them as scans is not. The user agent is only inspected here, never
// stored. `bot` must end a word and not be the phone brand CUBOT; a bare
// `preview` is not matched, real in-app browsers carry it too.
const NON_HUMAN_USER_AGENT =
  /(?<!cu)bot\b|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|skypeuripreview|embedly|quora link|pinterest|vkshare|w3c_validator/i

interface ResolvedLink {
  source: string
  medium: string
  campaign: string
  content: string
  destination: string
}

function redirectTo(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { location, 'cache-control': 'no-store' },
  })
}

async function resolveLink(env: Env, slug: string, count: boolean): Promise<ResolvedLink | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/resolve_campaign_link`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_slug: slug, p_count: count }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) return null
  const [link] = await response.json<ResolvedLink[]>()
  return link ?? null
}

/** Returns the redirect for `/r/:slug`, or `null` when the request is not for
 * that route (so the caller can fall through to the asset pipeline). */
export async function handleCampaignRedirect(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url)
  const match = SLUG_PATH_PATTERN.exec(url.pathname)
  if (!match || (request.method !== 'GET' && request.method !== 'HEAD')) return null

  const home = new URL('/', url).toString()
  const count =
    request.method === 'GET' && !NON_HUMAN_USER_AGENT.test(request.headers.get('user-agent') ?? '')

  let link: ResolvedLink | null = null
  try {
    link = await resolveLink(env, match[1].toLowerCase(), count)
  } catch {
    // Outage or timeout: fall through to the home page below.
  }
  if (!link) return redirectTo(home)

  const target = new URL(link.destination, url)
  // The database only stores internal paths; this is the second lock.
  if (target.origin !== url.origin) return redirectTo(home)
  target.searchParams.set('utm_source', link.source)
  target.searchParams.set('utm_medium', link.medium)
  target.searchParams.set('utm_campaign', link.campaign)
  if (link.content) target.searchParams.set('utm_content', link.content)
  return redirectTo(target.toString())
}
