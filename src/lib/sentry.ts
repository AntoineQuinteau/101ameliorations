import * as Sentry from '@sentry/react'

/** Initializes Sentry (spec §7's "Monitoring" line). `VITE_SENTRY_DSN` is
 * deliberately not part of src/env.ts's required-variable schema (see the
 * comment there): without it, this is a silent no-op and the app starts
 * normally — a Sentry account is optional, never a deployment blocker.
 *
 * Called as the very first statement in src/main.tsx, so Sentry is armed
 * before the React tree renders. It cannot, however, catch src/env.ts's own
 * "Invalid environment variables" throw (the exact failure the README
 * documents on a misconfigured Cloudflare preview): that throw happens
 * while main.tsx's *imports* are still being resolved, before any of
 * main.tsx's own top-level code — this call included — has run. Catching
 * that one specific failure would need Sentry armed from a plain <script>
 * in index.html, ahead of the module script entirely; not worth it here,
 * since the failure is already loud (console error, blank page) and, before
 * it ever reaches a deployed page, caught by the CI smoke build. */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Free-tier friendly: errors only, no performance tracing or session replay.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Emails must never leave the app (spec §2) — this would otherwise
    // attach browser-derived personal data (IP, etc.) to events.
    sendDefaultPii: false,
  })
}
