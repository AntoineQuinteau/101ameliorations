import type { Page } from '@playwright/test'
import { dismissInstallBanner } from './dismissInstallBanner'
import { getLatestOtpCode } from './otp'

/**
 * Drives the full `/login` flow (spec §6.4): email -> Turnstile (invisible,
 * auto-passes locally with Cloudflare's dummy sitekey, see
 * VITE_TURNSTILE_SITE_KEY in .env.local) -> 6-digit code, read from Mailpit
 * -> optional nickname step.
 *
 * Works for both a brand-new email (nickname step appears, since
 * `profiles.display_name` starts null) and a returning one that already has
 * a pseudo (e.g. the seeded staff accounts — nickname step never appears,
 * see src/features/auth/nicknamePrompt.ts's `shouldPromptForPseudo`).
 *
 * Assumes `page` is already on `/login` (with or without `?next=`) when
 * called.
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  await dismissInstallBanner(page)
  await page.getByLabel('Adresse email').fill(email)

  const sentAt = Date.now()
  await page.getByRole('button', { name: 'Recevoir le code' }).click()

  await page.getByLabel('Code de connexion').waitFor({ state: 'visible' })
  const code = await getLatestOtpCode(email, sentAt)
  await page.getByLabel('Code de connexion').fill(code)
  await page.getByRole('button', { name: 'Valider' }).click()

  await skipNicknameStepIfShown(page)
}

/**
 * After submitting a valid OTP code on `/login`, either the nickname step
 * appears (fresh account, no `profiles.display_name` yet) or the page
 * navigates straight past it (a returning account, e.g. the seeded staff
 * accounts — see src/features/auth/nicknamePrompt.ts's
 * `shouldPromptForPseudo`). Races the two rather than assuming one, then
 * dismisses the nickname step if it showed up, and waits for the
 * navigation off `/login` either way.
 *
 * Exported separately from `loginAs` for specs that drive the email/code
 * steps themselves (e.g. to control resend timing) but still need this same
 * tail once a code has been submitted.
 */
export async function skipNicknameStepIfShown(page: Page): Promise<void> {
  const skipButton = page.getByRole('button', { name: 'Passer' })
  await Promise.race([
    skipButton.waitFor({ state: 'visible' }),
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 }),
  ]).catch(() => {
    // Neither happened within the race's own waits — fall through and let
    // the explicit check below produce a clear failure instead of a vague
    // Promise.race timeout.
  })

  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click()
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
}
