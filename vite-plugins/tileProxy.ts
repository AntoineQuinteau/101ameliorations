import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Plugin } from 'vite'

const ROUTE_PREFIX = '/__tiles/'
const CACHE_DIR = join(process.cwd(), '.cache', 'maptiler')
const UPSTREAM_ORIGIN = 'https://api.maptiler.com'
const FETCH_TIMEOUT_MS = 5000

// Matches exactly the two upstream paths src/features/map/tileUrls.ts composes for the
// two layers in src/features/map/MapTiles.tsx — nothing else. This is a proxy for this
// app's two tilesets, not an open relay onto MapTiler's wider API: without this, anyone
// who can reach the dev server (or, worse, a misconfigured CI runner) could use it to
// burn the upstream key against arbitrary MapTiler endpoints.
const TILE_PATH_PATTERN =
  /^\/(maps\/streets-v2\/\d+\/\d+\/\d+(?:@2x)?\.png|tiles\/satellite-v2\/\d+\/\d+\/\d+\.jpg)$/

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
}

// A tiny valid PNG, served whenever there's no upstream key configured or the upstream
// fetch fails — see the plugin docblock below for why a placeholder rather than an
// error. Real image bytes (not raw garbage) so the browser's `<img>` decoder never
// chokes; the Content-Type header (not the file extension in the URL) is what browsers
// actually sniff on, so this single PNG covers both the streets and satellite paths.
const PLACEHOLDER_TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

function extensionOf(pathname: string): string {
  const match = /\.(png|jpg)$/.exec(pathname)
  return match ? `.${match[1]}` : '.png'
}

async function readFromDiskCache(cachePath: string): Promise<Buffer | null> {
  try {
    const cached = await readFile(cachePath)
    // A 0-byte file is a truthy Buffer but never a real tile — the mark of a write
    // that was interrupted before writeToDiskCache's rename below could land (or, in
    // principle, an upstream that itself returned an empty body). Treating it as a
    // miss here, at the single read path, means every caller keeps the simple
    // `null` = miss / `Buffer` = hit contract instead of re-checking `.length` itself.
    return cached.length > 0 ? cached : null
  } catch {
    return null
  }
}

async function writeToDiskCache(cachePath: string, body: Buffer): Promise<void> {
  await mkdir(dirname(cachePath), { recursive: true })
  // Write-then-rename rather than a direct writeFile (which truncates in place): a
  // crash, ENOSPC, or another request racing this one would otherwise be able to
  // observe (or permanently leave behind) a partially-written file at cachePath.
  // rename() is atomic on the same filesystem, so cachePath only ever transitions
  // between "absent" and "fully written" — never a half-written state in between.
  const tmpPath = `${cachePath}.${randomUUID()}.tmp`
  await writeFile(tmpPath, body)
  await rename(tmpPath, cachePath)
}

/** Dev-only Vite plugin (`apply: 'serve'` — never runs in `vite build`, so it can never
 * end up in the production bundle) that serves MapTiler tiles from a same-origin path
 * instead of the client requesting them from MapTiler directly.
 *
 * Why this exists: `npm run dev` has no service worker (`vite.config.ts`'s `VitePWA` has
 * no `devOptions`), so nothing caches tiles locally — every pinch-zoom or pan during a
 * debugging session re-fetches from MapTiler, and Playwright's e2e specs (which run
 * against `npm run dev`, see `playwright.config.ts`) load the map on almost every login.
 * Both were burning real MapTiler quota for zero benefit.
 *
 * Two upstream modes, both keyed on whether `maptilerKey` (read from `MAPTILER_KEY` —
 * deliberately not `VITE_`-prefixed, so it's read server-side only in
 * `vite.config.ts` and never lands in the client bundle) was configured:
 *
 * - **No key** (the CI default, and a new contributor's default): every request is
 *   answered with `PLACEHOLDER_TILE` and nothing ever reaches MapTiler. This is the
 *   single rule that makes CI's tile cost zero without a separate flag, and lets anyone
 *   run the app with no MapTiler key at all.
 * - **Key present** (a contributor's own `.env.local`): tiles are fetched from MapTiler
 *   once and cached to disk under `.cache/maptiler/` (git-ignored), keyed by the
 *   upstream path itself — so the cache survives both page reloads and dev-server
 *   restarts, unlike the service worker cache this stands in for. An upstream failure
 *   (network error, non-200) falls back to the placeholder rather than a broken image or
 *   a 502 that would otherwise block rendering the rest of the map. */
export function tileProxy(maptilerKey: string | undefined): Plugin {
  return {
    name: 'tile-proxy',
    apply: 'serve',
    configureServer(server) {
      server.config.logger.info(
        maptilerKey
          ? `[tile-proxy] Proxying MapTiler tiles through ${ROUTE_PREFIX}, cached in .cache/maptiler/`
          : `[tile-proxy] No MAPTILER_KEY set — serving placeholder tiles, MapTiler is never called`,
      )

      server.middlewares.use(ROUTE_PREFIX, async (req, res, next) => {
        if (req.method !== 'GET' || !req.url) {
          next()
          return
        }

        // `req.url` here is already relative to ROUTE_PREFIX (Connect strips the mount
        // path); parse against a dummy base purely to drop a stray `?key=…` the client
        // may still have appended (see tileUrls.ts) — the proxy always uses its own key.
        const pathname = new URL(req.url, 'http://localhost').pathname
        if (!TILE_PATH_PATTERN.test(pathname)) {
          res.statusCode = 404
          res.end()
          return
        }

        const contentType = CONTENT_TYPE_BY_EXTENSION[extensionOf(pathname)]
        const cachePath = join(CACHE_DIR, pathname)

        const cached = await readFromDiskCache(cachePath)
        if (cached) {
          res.statusCode = 200
          res.setHeader('Content-Type', contentType)
          res.end(cached)
          return
        }

        if (!maptilerKey) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'image/png')
          res.end(PLACEHOLDER_TILE)
          return
        }

        try {
          const upstream = await fetch(`${UPSTREAM_ORIGIN}${pathname}?key=${maptilerKey}`, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          })
          if (!upstream.ok) throw new Error(`upstream responded ${upstream.status}`)

          const body = Buffer.from(await upstream.arrayBuffer())

          // Deliberately off the response path: a cache write failure (read-only
          // .cache/, ENOSPC) must never throw away tile bytes MapTiler already served
          // successfully. Logged separately so it's never mistaken for the upstream
          // fetch failure the catch block below reports.
          void writeToDiskCache(cachePath, body).catch((error: unknown) => {
            server.config.logger.warn(`[tile-proxy] cache write failed for ${pathname}: ${error}`)
          })

          res.statusCode = 200
          res.setHeader('Content-Type', contentType)
          res.end(body)
        } catch (error) {
          server.config.logger.warn(`[tile-proxy] upstream fetch failed for ${pathname}: ${error}`)
          res.statusCode = 200
          res.setHeader('Content-Type', 'image/png')
          res.end(PLACEHOLDER_TILE)
        }
      })
    },
  }
}
