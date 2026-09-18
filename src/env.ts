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
const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_MAPTILER_KEY: z.string().min(1),
  VITE_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
})

const parsed = schema.safeParse(import.meta.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables — see console for details.')
}

export const env = parsed.data
