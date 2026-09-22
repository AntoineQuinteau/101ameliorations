import { z } from 'zod'

// VITE_SENTRY_DSN is deliberately not listed here: it's optional (see
// src/lib/sentry.ts) and must never make the app fail to start.
//
// VITE_TURNSTILE_SITE_KEY is optional for the same reason as the Sentry DSN,
// but for a stronger one: this var throws at module load when invalid, so a
// *required* key with no value yet would white-screen every preview build
// before the Turnstile widget has been created in the Cloudflare dashboard
// (step 9). Supabase's captcha enforcement is a project-level server-side
// toggle — see src/features/auth/useTurnstile.ts — so the client and the
// dashboard switch must be able to land independently.
//
// VITE_MAPTILER_KEY is conditionally required: see the superRefine below —
// it's only actually needed when tiles are requested straight from MapTiler.
//
// VITE_TILE_BASE_URL is optional and unset in production: it overrides
// MapTiler's own host with a same-origin path, used by the dev/CI tile proxy
// (see vite.config.ts and src/features/map/tileUrls.ts). Left unset, tiles
// are requested straight from MapTiler, exactly as before this var existed.
const schema = z
  .object({
    VITE_SUPABASE_URL: z.string().url(),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    VITE_MAPTILER_KEY: z.string().min(1).optional(),
    VITE_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    VITE_TILE_BASE_URL: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    // A custom VITE_TILE_BASE_URL means something else (the dev/CI proxy today, an edge
    // proxy in future) sits between the client and MapTiler and holds its own upstream
    // key server-side — the client then never needs one. Only the default, talking to
    // MapTiler directly, actually requires VITE_MAPTILER_KEY. Keeping it unconditionally
    // required would force every contributor to hold a MapTiler key just to run `npm run
    // dev`, which the proxy is specifically meant to avoid.
    if (!value.VITE_TILE_BASE_URL && !value.VITE_MAPTILER_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['VITE_MAPTILER_KEY'],
        message: 'Required unless VITE_TILE_BASE_URL points away from MapTiler',
      })
    }
  })

const parsed = schema.safeParse(import.meta.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables — see console for details.')
}

export const env = parsed.data
