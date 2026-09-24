/**
 * Variables a deployable build cannot do without. Each is inlined into the
 * bundle at build time, so a build missing one ships a site that is broken
 * for everyone — and nothing at runtime can fix it:
 *
 * - VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY: src/env.ts throws at
 *   module load, blank page.
 * - VITE_TURNSTILE_SITE_KEY: the app loads, but never runs Turnstile, so
 *   every OTP request carries no captcha token and Supabase (captcha on)
 *   rejects all logins — "no captcha_token found". This is exactly what a
 *   second deploy path (Cloudflare Workers Builds, building `main` without
 *   this variable) put in production on 2026-09-24.
 *
 * src/env.ts keeps VITE_TURNSTILE_SITE_KEY optional for local development;
 * this guard only applies to `vite build` in production mode.
 */
const REQUIRED_FOR_DEPLOY = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_TURNSTILE_SITE_KEY',
] as const

/** Cloudflare's dummy site keys (1x…, 2x…, 3x…): valid only against the
 * matching dummy secret, so a real Supabase project rejects their tokens. */
const TURNSTILE_TEST_SITE_KEY = /^[123]x0+[A-Z]{2}$/

/** Set to `1` to build anyway (e.g. a throwaway local `npm run build` to try
 * the service worker). Never set it in anything that deploys. */
export const ALLOW_INCOMPLETE_BUILD_ENV = 'ALLOW_INCOMPLETE_BUILD_ENV'

/** Returns one message per problem; empty when the build may proceed. */
export function buildEnvProblems(env: Record<string, string | undefined>): string[] {
  if (env[ALLOW_INCOMPLETE_BUILD_ENV] === '1') return []

  const problems: string[] = REQUIRED_FOR_DEPLOY.filter((name) => !env[name]?.trim()).map(
    (name) => `${name} is missing or empty`,
  )
  const siteKey = env.VITE_TURNSTILE_SITE_KEY?.trim()
  if (siteKey && TURNSTILE_TEST_SITE_KEY.test(siteKey)) {
    problems.push(
      `VITE_TURNSTILE_SITE_KEY is a Cloudflare test key (${siteKey}), rejected by any real Supabase project`,
    )
  }
  return problems
}

/** Throws, failing `vite build`, when the environment would produce a
 * broken production bundle. */
export function assertDeployableBuildEnv(env: Record<string, string | undefined>): void {
  const problems = buildEnvProblems(env)
  if (problems.length === 0) return
  throw new Error(
    [
      'Refusing to build a production bundle that would break the deployed site:',
      ...problems.map((problem) => `  - ${problem}`),
      `See README.md § "Déploiement". For a throwaway local build only, set ${ALLOW_INCOMPLETE_BUILD_ENV}=1.`,
    ].join('\n'),
  )
}
