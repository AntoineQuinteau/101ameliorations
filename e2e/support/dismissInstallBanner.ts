import type { Page } from '@playwright/test'

/**
 * Dismisses the PWA install banner (src/features/pwa/InstallPrompt.tsx,
 * spec §7) if it's showing.
 *
 * On the `mobile-iphone-13` project specifically, `devices['iPhone 13']`'s
 * user agent makes `shouldShowIosInstallHint` (src/features/pwa/
 * iosInstall.ts) genuinely true, so the fixed `inset-x-0 bottom-0` banner
 * legitimately renders on every page load — it isn't a test artifact. It
 * then overlaps whatever sits at the bottom of a short viewport (the
 * creation sheet's own buttons, /me's "Supprimer mon compte…"), which is
 * exactly the class of bug docs/handoff.md's step-7 notes warn desktop-only
 * testing misses. A real user on that device would dismiss or scroll past
 * it; tests do the equivalent here rather than special-casing every
 * bottom-of-viewport click.
 */
export async function dismissInstallBanner(page: Page): Promise<void> {
  const closeButton = page.getByRole('button', { name: 'Fermer' })
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click()
  }
}
