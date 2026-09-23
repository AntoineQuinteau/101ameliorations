/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { tileProxy } from './vite-plugins/tileProxy'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Third argument '' (rather than the default 'VITE_' prefix) so this also picks up
  // MAPTILER_KEY — deliberately unprefixed, see vite-plugins/tileProxy.ts, so it never
  // gets inlined into the client bundle the way a VITE_-prefixed var would.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      tileProxy(env.MAPTILER_KEY),
      VitePWA({
        // The SW checks for an update on load and swaps in the new one without
        // asking (spec §7). Preview builds share one stable alias URL for the
        // whole PR (see .github/workflows/ci.yml) — with autoUpdate a reload
        // after each push actually picks up the new build, which prompted mode
        // would not do without extra UI wired to `needRefresh`.
        registerType: 'autoUpdate',
        manifest: {
          // Mirrors src/i18n/fr.ts (fr.app.name / fr.app.tagline) — duplicated
          // rather than imported because this file and src/ sit in separate
          // TypeScript project-reference roots (tsconfig.node.json vs
          // tsconfig.app.json). Keep the two in sync by hand.
          name: '101améliorations',
          short_name: '101améliorations',
          description:
            'Signalement des problèmes sur les voies cyclables du Pays basque et du sud des Landes',
          lang: 'fr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          // Brand teal, also src/index.css's marker color and public/favicon.svg.
          theme_color: '#0f766e',
          background_color: '#0f766e',
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // MapTiler tiles (spec §7): recent tiles stay available offline,
              // capped so the cache can't grow without bound.
              //
              // KNOWN GAP — statuses: [0, 200] below caches opaque (status 0) responses
              // as well as real 200s. Leaflet's <img> tile requests have no `crossorigin`
              // attribute, so every MapTiler response — including a 403 from an
              // exhausted quota (see docs/plans/tile-edge-proxy.md's replacement plan,
              // and src/features/map/tileFailover.ts) — comes back opaque, and the
              // browser deliberately hides the real status from JS in that mode:
              // Workbox cannot tell an opaque error from an opaque success. During a
              // MapTiler outage this can cache a *blank* tile for the full 30 days
              // below, staying blank even once MapTiler recovers. Fixing this needs
              // `crossOrigin` set on the MapTiler `TileLayerSpec`s
              // (src/features/map/tileProviders.ts) *and* `statuses` narrowed to
              // `[200]` here, together — but only once MapTiler's tile responses are
              // confirmed (on a live preview, not this sandbox) to actually send
              // `Access-Control-Allow-Origin`: without it, `crossOrigin` makes the
              // `<img>` request itself fail, which is strictly worse. Left as `[0, 200]`
              // until that's confirmed.
              urlPattern: ({ url }) => url.hostname === 'api.maptiler.com',
              handler: 'CacheFirst',
              options: {
                cacheName: 'maptiler-tiles',
                // Two layers (plan + satellite) and deeper zoom levels than before churn
                // through this cache faster than the original 500-entry cap allowed for.
                // Raster tiles change only when MapTiler updates a style, essentially
                // never — 30 days keeps a tile long past any single visit. 2000 entries
                // at ~30-60KB each caps this around 60-120MB, comfortably under mobile
                // per-origin storage quotas even alongside the photo and shell caches
                // below (Workbox's expiration plugin evicts LRU, so this is a ceiling,
                // not a reservation).
                expiration: { maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // IGN fallback tiles (France's Géoplateforme + Spain's IGN — see
              // src/features/map/tileProviders.ts): kept in a cache of its own, separate
              // from maptiler-tiles, so a MapTiler outage that triggers the fallback
              // doesn't evict MapTiler's own still-good cache, and vice versa on
              // recovery. Same known opaque-response caveat as maptiler-tiles above —
              // narrower `bounds` on these layers (a few thousand tiles at most, see
              // that file) makes a 1000-entry cap generous rather than tight.
              urlPattern: ({ url }) =>
                url.hostname === 'data.geopf.fr' || url.hostname === 'www.ign.es',
              handler: 'CacheFirst',
              options: {
                cacheName: 'ign-tiles',
                expiration: { maxEntries: 1000, maxAgeSeconds: 30 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // CyclOSM "Vélo" layer tiles (spec §6.1 follow-up). Shorter freshness
              // window than the other two basemaps: OSM's own tile usage policy asks
              // for normal interactive viewing only (no prefetching), so this cache
              // exists purely to let a tile already seen this week redraw instantly —
              // not to build up an offline set the way maptiler-tiles/ign-tiles do.
              urlPattern: ({ url }) => url.hostname.endsWith('.tile-cyclosm.openstreetmap.fr'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'cyclosm-tiles',
                expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Klash photos: same reasoning as the tiles above.
              urlPattern: ({ url }) =>
                url.hostname.endsWith('.supabase.co') &&
                url.pathname.startsWith('/storage/v1/object/public/klash-photos/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'klash-photos',
                expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // klashes_public only, not the RPCs or any authenticated write —
              // it's the one Supabase read whose response is identical for
              // anon and authenticated callers alike, so the service worker
              // (which cannot see localStorage's session) never risks serving
              // one viewer's data to another. Short freshness window: this is
              // "let the map render offline for a moment", not an offline data
              // store.
              urlPattern: ({ url }) =>
                url.hostname.endsWith('.supabase.co') &&
                url.pathname.startsWith('/rest/v1/klashes_public'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'klashes-public',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  }
})
