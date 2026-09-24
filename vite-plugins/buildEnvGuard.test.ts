import { describe, expect, it } from 'vitest'
import { assertDeployableBuildEnv, buildEnvProblems } from './buildEnvGuard'

const complete = {
  VITE_SUPABASE_URL: 'https://example.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  VITE_TURNSTILE_SITE_KEY: '0x4AAAAAAE8A59vfgWvXjePX',
}

describe('buildEnvProblems', () => {
  it('accepts a complete production environment', () => {
    expect(buildEnvProblems(complete)).toEqual([])
  })

  it('flags a missing or blank Turnstile site key (the 2026-09-24 outage)', () => {
    expect(buildEnvProblems({ ...complete, VITE_TURNSTILE_SITE_KEY: undefined })).toEqual([
      'VITE_TURNSTILE_SITE_KEY is missing or empty',
    ])
    expect(buildEnvProblems({ ...complete, VITE_TURNSTILE_SITE_KEY: '  ' })).toHaveLength(1)
  })

  it('flags every missing Supabase variable', () => {
    expect(buildEnvProblems({ VITE_TURNSTILE_SITE_KEY: complete.VITE_TURNSTILE_SITE_KEY })).toEqual(
      [
        'VITE_SUPABASE_URL is missing or empty',
        'VITE_SUPABASE_PUBLISHABLE_KEY is missing or empty',
      ],
    )
  })

  it("rejects Cloudflare's dummy site keys", () => {
    for (const key of [
      '1x00000000000000000000BB',
      '2x00000000000000000000AB',
      '3x00000000000000000000FF',
    ]) {
      expect(buildEnvProblems({ ...complete, VITE_TURNSTILE_SITE_KEY: key })).toHaveLength(1)
    }
  })

  it('can be bypassed explicitly for a throwaway local build', () => {
    expect(buildEnvProblems({ ALLOW_INCOMPLETE_BUILD_ENV: '1' })).toEqual([])
  })
})

describe('assertDeployableBuildEnv', () => {
  it('throws with every problem listed', () => {
    expect(() => assertDeployableBuildEnv({})).toThrow(/VITE_TURNSTILE_SITE_KEY is missing/)
  })

  it('does not throw for a complete environment', () => {
    expect(() => assertDeployableBuildEnv(complete)).not.toThrow()
  })
})
