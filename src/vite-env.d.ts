/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  // Conditionally required — see src/env.ts's superRefine.
  readonly VITE_MAPTILER_KEY?: string
  // Optional — see src/lib/sentry.ts. Not in src/env.ts's schema: it must
  // stay valid with this unset.
  readonly VITE_SENTRY_DSN?: string
  // Optional — overrides MapTiler's own host for the dev/CI tile proxy. See
  // src/env.ts and src/features/map/tileUrls.ts.
  readonly VITE_TILE_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
