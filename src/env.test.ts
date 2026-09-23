import { afterEach, describe, expect, it, vi } from 'vitest'

const REQUIRED_VARS = {
  VITE_SUPABASE_URL: 'https://x.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
}

// Every optional var this module validates, forced to '' (env.ts treats that the same
// as unset — see its optionalString comment) unless a test overrides it. Without this,
// a contributor's own .env.local leaks its real VITE_MAPTILER_KEY/VITE_TURNSTILE_SITE_KEY
// into import.meta.env before vi.stubEnv ever runs, and tests that assume those vars are
// absent fail on their machine while passing on a clean checkout.
const OPTIONAL_VARS = {
  VITE_MAPTILER_KEY: '',
  VITE_TURNSTILE_SITE_KEY: '',
  VITE_TILE_BASE_URL: '',
}

// Each import.meta.env field this module validates is re-evaluated once, at module
// load — vi.resetModules() plus a fresh dynamic import is what forces that
// re-evaluation per test, since a plain top-level `import` would reuse the first
// module instance for the rest of the file.
async function loadEnvWith(vars: Record<string, string>) {
  for (const [key, value] of Object.entries({ ...OPTIONAL_VARS, ...REQUIRED_VARS, ...vars })) {
    vi.stubEnv(key, value)
  }
  vi.resetModules()
  return import('./env')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('env', () => {
  it('accepts the base required vars plus a real VITE_MAPTILER_KEY', async () => {
    const { env } = await loadEnvWith({ VITE_MAPTILER_KEY: 'maptiler-key' })
    expect(env.VITE_MAPTILER_KEY).toBe('maptiler-key')
    expect(env.VITE_TILE_BASE_URL).toBeUndefined()
  })

  it('throws when neither VITE_MAPTILER_KEY nor VITE_TILE_BASE_URL is set', async () => {
    await expect(loadEnvWith({})).rejects.toThrow('Invalid environment variables')
  })

  it('does not require VITE_MAPTILER_KEY once VITE_TILE_BASE_URL points away from MapTiler', async () => {
    const { env } = await loadEnvWith({ VITE_TILE_BASE_URL: '/__tiles' })
    expect(env.VITE_MAPTILER_KEY).toBeUndefined()
    expect(env.VITE_TILE_BASE_URL).toBe('/__tiles')
  })

  // Regression test for the review finding: Vite's loadEnv keeps an explicitly-empty
  // `KEY=` .env.local line as '', not as absent — so `cp .env.example .env.local`
  // must not white-screen the app on any of its optional vars left blank.
  it('treats an empty string exactly like an unset var, for every optional var', async () => {
    const { env } = await loadEnvWith({
      VITE_MAPTILER_KEY: '',
      VITE_TURNSTILE_SITE_KEY: '',
      VITE_TILE_BASE_URL: '/__tiles',
    })
    expect(env.VITE_MAPTILER_KEY).toBeUndefined()
    expect(env.VITE_TURNSTILE_SITE_KEY).toBeUndefined()
  })

  it('still throws on an empty required var (VITE_SUPABASE_URL)', async () => {
    await expect(loadEnvWith({ VITE_SUPABASE_URL: '', VITE_MAPTILER_KEY: 'x' })).rejects.toThrow(
      'Invalid environment variables',
    )
  })
})
