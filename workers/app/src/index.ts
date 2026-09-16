// Rewrites the Open Graph / Twitter tags on /k/:id (spec §6.3, §9.8) so a
// shared link previews with the klash's own title, description and photo —
// something a client-side SPA cannot do itself, since crawlers never run
// its JS. Every other route falls through to the normal asset pipeline
// unchanged (see wrangler.jsonc's `assets.run_worker_first`, scoped to
// `/k/*` only).
//
// This is a bonus, never a point of failure for the page: any error —
// klash not found, Supabase unreachable, a timeout, missing env vars —
// falls back to serving the shell untouched, with its static default tags
// (see index.html).

export interface Env {
  ASSETS: Fetcher
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
}

const KLASH_PATH_PATTERN = /^\/k\/([0-9a-f-]{36})\/?$/i
const FETCH_TIMEOUT_MS = 1500
const SITE_NAME = '101améliorations'
// Mirrors src/i18n/fr.ts's fr.app.tagline — see vite.config.ts for why this
// can't just import that file (separate TypeScript project roots).
const FALLBACK_DESCRIPTION =
  'Signalement des problèmes sur les voies cyclables du Pays basque et du sud des Landes.'

interface KlashPreview {
  title: string
  description: string | null
  imageUrl: string | null
}

interface KlashPreviewRow {
  title: string
  description: string | null
}

interface KlashPhotoRow {
  storage_path: string
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Reads the klash's title/description and, if it has one, its first photo —
 * straight from PostgREST with the anon key, the same read a visitor's own
 * browser is allowed under RLS. Returns `null` for anything that isn't a
 * clean, complete read: a missing klash, a network error, a timeout. */
async function fetchKlashPreview(env: Env, klashId: string): Promise<KlashPreview | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null

  const headers = {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
  }
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)

  const klashResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/klashes_public?id=eq.${klashId}&select=title,description`,
    { headers, signal },
  )
  if (!klashResponse.ok) return null
  const [klash] = await klashResponse.json<KlashPreviewRow[]>()
  if (!klash) return null

  let imageUrl: string | null = null
  try {
    const photoResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/klash_photos?klash_id=eq.${klashId}&select=storage_path&order=created_at.asc&limit=1`,
      { headers, signal },
    )
    if (photoResponse.ok) {
      const [photo] = await photoResponse.json<KlashPhotoRow[]>()
      if (photo) {
        imageUrl = `${env.SUPABASE_URL}/storage/v1/object/public/klash-photos/${photo.storage_path}`
      }
    }
  } catch {
    // A klash with no photo (or a hiccup fetching one) still gets a preview,
    // just without an image — not worth failing the whole thing over.
  }

  return { title: klash.title, description: klash.description, imageUrl }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const match = request.method === 'GET' ? KLASH_PATH_PATTERN.exec(url.pathname) : null
    if (!match) return env.ASSETS.fetch(request)

    const klashId = match[1]
    const preview = await fetchKlashPreview(env, klashId).catch(() => null)

    // Fetching the original request as-is, not `/index.html` directly: the
    // asset server's `not_found_handling: 'single-page-application'` serves
    // the shell for any unmatched path, but an *explicit* request for
    // `/index.html` instead hits its URL-normalization redirect (a
    // `/index.html` request is bounced to `/`) — this would otherwise send
    // every klash link into a redirect loop back to the map.
    const shellResponse = await env.ASSETS.fetch(request)
    if (!preview) return shellResponse

    const title = `${preview.title} — ${SITE_NAME}`
    const description = preview.description?.trim() || FALLBACK_DESCRIPTION
    const imageUrl = preview.imageUrl ?? new URL('/og-image.png', url).toString()
    // HTMLRewriter escapes values passed to setInnerContent/setAttribute
    // itself — only this hand-built tag (there is no static og:url to
    // rewrite in place) needs manual escaping.
    const ogUrlTag = `<meta property="og:url" content="${escapeHtmlAttribute(url.toString())}">`

    const rewritten = new HTMLRewriter()
      .on('title', {
        element(element) {
          element.setInnerContent(title)
        },
      })
      .on('meta[name="description"]', {
        element(element) {
          element.setAttribute('content', description)
        },
      })
      .on('meta[property="og:title"]', {
        element(element) {
          element.setAttribute('content', title)
        },
      })
      .on('meta[property="og:description"]', {
        element(element) {
          element.setAttribute('content', description)
        },
      })
      .on('meta[property="og:image"]', {
        element(element) {
          element.setAttribute('content', imageUrl)
        },
      })
      .on('head', {
        element(element) {
          element.append(ogUrlTag, { html: true })
        },
      })
      .transform(shellResponse)

    // The edge cache absorbs crawler bursts without freezing a stale title
    // for long — this is metadata for a preview, not the page itself.
    const response = new Response(rewritten.body, rewritten)
    response.headers.set('cache-control', 'public, max-age=0, s-maxage=300')
    return response
  },
} satisfies ExportedHandler<Env>
