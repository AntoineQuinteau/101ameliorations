/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
            urlPattern: ({ url }) => url.hostname === 'api.maptiler.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'maptiler-tiles',
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
})
