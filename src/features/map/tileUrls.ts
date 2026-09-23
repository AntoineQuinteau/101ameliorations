import type { MapLayer } from './MapTiles'

/** MapTiler's own host. The default for `VITE_TILE_BASE_URL` (see `src/env.ts`), so a
 * deployment that never sets that var gets byte-identical URLs to before this indirection
 * existed — verified by `tileUrls.test.ts`. */
export const DEFAULT_TILE_BASE_URL = 'https://api.maptiler.com'

/** Builds the `<TileLayer url>` template for one layer, against `baseUrl` instead of
 * hardcoding MapTiler's host. This is what lets the dev server (`vite.config.ts`'s
 * tile-proxy plugin) and CI point the map at a same-origin path — `/__tiles` — that never
 * reaches MapTiler at all, while production keeps talking to MapTiler directly.
 *
 * `{z}`/`{x}`/`{y}`/`{r}` are left as literal placeholders: react-leaflet's `TileLayer`
 * substitutes them per tile, this function never sees per-tile values. `key` is omitted
 * from the query string entirely when absent (the proxy holds its own upstream key
 * server-side — see `MAPTILER_KEY` in `vite.config.ts` — and must never receive one from
 * the client that it would then have to strip). */
export function buildTileUrlTemplate(layer: MapLayer, baseUrl: string, key?: string): string {
  const path =
    layer === 'satellite'
      ? '/tiles/satellite-v2/{z}/{x}/{y}.jpg'
      : '/maps/streets-v2/{z}/{x}/{y}{r}.png'
  const query = key ? `?key=${key}` : ''
  return `${baseUrl}${path}${query}`
}

/** The MapTiler key belongs on the request only when `baseUrl` actually points at
 * MapTiler. Once it points elsewhere — the dev/CI proxy today
 * (`vite-plugins/tileProxy.ts`), a future edge proxy — that destination holds its own
 * upstream key server-side and must never receive the client's, which `MapTiles.tsx`
 * would otherwise still be inlining into the production bundle and sending on every
 * tile request for no reason. Called once at the single point both `<TileLayer>` props
 * read from, so the invariant holds by construction instead of depending on nobody
 * ever setting both `VITE_MAPTILER_KEY` and a custom `VITE_TILE_BASE_URL` at once. */
export function resolveTileKey(baseUrl: string, key: string | undefined): string | undefined {
  return baseUrl === DEFAULT_TILE_BASE_URL ? key : undefined
}
