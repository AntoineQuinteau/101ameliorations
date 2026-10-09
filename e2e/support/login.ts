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
 * a pseudo (e.g. the e2e staff accounts — nickname step never appears,
 * see src/features/auth/nicknamePrompt.ts's `shouldPromptForPseudo`).
 *
 * Never log in to the same address from two workers at once: Supabase keeps
 * a single OTP per user. Staff specs use `staffEmail` (./staff.ts), which
 * gives each worker its own accounts.
 *
 * Assumes `page` is already on `/login` (with or without `?next=`) when
 * called.
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  await dismissInstallBanner(page)
  await page.getByLabel('Adresse email').fill(email)

  const requestedAt = await requestOtpCode(page)
  const code = await getLatestOtpCode(email, requestedAt)
  await page.getByLabel('Code de connexion').fill(code)
  await page.getByRole('button', { name: 'Valider' }).click()

  await skipNicknameStepIfShown(page)
}

// Supabase refuses a second OTP email to the same address within
// `auth.email.max_frequency` (1s, supabase/config.toml). Back-to-back tests in
// one worker can log in to the same staff account that quickly, so a refused
// send is retried a few times.
const OTP_SEND_ATTEMPTS = 3
const OTP_RESEND_DELAY_MS = 1_500
const OTP_REQUEST_TIMEOUT_MS = 15_000

/**
 * Clicks "Recevoir le code" and waits for the code step, retrying when the
 * send was refused for being too soon after another one to the same address
 * (`auth.email.max_frequency`).
 * Any other error shown instead of the code step fails right away, with its
 * text, rather than as an opaque timeout. Returns when the request that
 * produced the code was made, for `getLatestOtpCode`'s staleness guard.
 */
async function requestOtpCode(page: Page): Promise<number> {
  const codeField = page.getByLabel('Code de connexion')
  const errorAlert = page.getByRole('alert')

  for (let attempt = 1; ; attempt++) {
    const requestedAt = Date.now()
    await page.getByRole('button', { name: 'Recevoir le code' }).click()

    // The app clears the previous error as soon as a new request starts, so
    // an alert seen here belongs to this attempt.
    await codeField.or(errorAlert).first().waitFor({ timeout: OTP_REQUEST_TIMEOUT_MS })
    if (await codeField.isVisible()) return requestedAt

    const message = ((await errorAlert.first().textContent()) ?? '').trim()
    if (!message.includes('Trop de tentatives')) {
      throw new Error(`Requesting the login code failed: ${message}`)
    }
    if (attempt === OTP_SEND_ATTEMPTS) {
      throw new Error(`Login code still refused after ${OTP_SEND_ATTEMPTS} attempts: ${message}`)
    }
    await page.waitForTimeout(OTP_RESEND_DELAY_MS)
  }
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
