import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'

// Local sandbox: no network egress to Playwright's CDN, so a managed
// browser can't be downloaded (`npx playwright install`). A system Chromium
// happens to be available at this fixed path (used successfully before —
// see docs/handoff.md step 7 notes) and is CDP-compatible enough with this
// @playwright/test version to drive tests. CI has real network access and
// must NOT use this override: it runs `npx playwright install --with-deps
// chromium` instead (see .github/workflows/ci.yml's `e2e` job) and expects
// Playwright's own managed browser at its own path. Gating on both
// `!process.env.CI` and the file actually existing means neither
// environment can silently pick up the other's browser.
const systemChromiumPath = '/usr/bin/chromium-browser'
const useSystemChromium = !process.env.CI && fs.existsSync(systemChromiumPath)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Capped rather than left at Playwright's default (CPU count): each test
  // drives real network calls against one local Supabase instance (Auth,
  // Postgres) shared by every worker, and 8 workers on this machine
  // produced a real, repeatable flake — signInWithOtp's response taking
  // long enough under that contention to blow a 30s test timeout — that
  // reducing concurrency to 4 always fixed. Not a logic bug (every affected
  // test also passed reliably alone); a resource ceiling on the shared
  // local backend.
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    ...(useSystemChromium ? { launchOptions: { executablePath: systemChromiumPath } } : {}),
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-iphone-13',
      // Required alongside desktop, not optional — see docs/handoff.md
      // step 7 "pièges": desktop-only testing missed real bugs that only
      // showed up on the iPhone 13 touch profile.
      //
      // devices['iPhone 13'] defaults to `browserName: 'webkit'`, which
      // isn't installed here (see the executablePath note above — only a
      // Chromium binary is available without network access). Forcing
      // 'chromium' keeps the iPhone 13 viewport/UA/touch emulation while
      // actually launching a browser that exists: leaving this unset made
      // Playwright pass WebKit's `--inspector-pipe` launch flag to the
      // Chromium binary, which then exited immediately and silently
      // (exitCode 0) with no useful error beyond "browser has been closed".
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  webServer: {
    // --host 127.0.0.1: Vite's default dev server binds to the IPv6
    // loopback ([::1]) only, which `baseURL`/`url` above (127.0.0.1, IPv4)
    // can't reach — this forces the IPv4 bind so the two agree.
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
