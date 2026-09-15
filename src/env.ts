import { z } from 'zod'

// VITE_SENTRY_DSN is deliberately not listed here: it's optional (see
// src/lib/sentry.ts) and must never make the app fail to start.
const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  VITE_MAPTILER_KEY: z.string().min(1),
})

const parsed = schema.safeParse(import.meta.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment variables — see console for details.')
}

export const env = parsed.data
