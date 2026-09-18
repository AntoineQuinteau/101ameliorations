import { test, expect } from '@playwright/test'
import { loginAs, skipNicknameStepIfShown } from './support/login'
import { getLatestOtpCode } from './support/otp'

function freshEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@101ameliorations.test`
}

test.describe('auth', () => {
  test('a brand-new email can log in end to end and the session persists across a reload', async ({
    page,
  }) => {
    const email = freshEmail('auth-new')

    await page.goto('/login')
    await loginAs(page, email)

    // A brand-new account with no `?next=` lands on the map.
    await expect(page).toHaveURL('/')

    // Session persists across a reload (spec §6.4: "Session persistante
    // (localStorage)") — the header should still show the signed-in state
    // rather than bouncing to /login.
    await page.goto('/me')
    await expect(page).toHaveURL('/me')
    await expect(page.getByRole('heading', { name: 'Mon espace' })).toBeVisible()

    await page.reload()
    await expect(page).toHaveURL('/me')
    await expect(page.getByRole('heading', { name: 'Mon espace' })).toBeVisible()
  })

  test('?next= sends a fresh login to the right place', async ({ page }) => {
    const email = freshEmail('auth-next')

    await page.goto('/login?next=%2Fme')
    await loginAs(page, email)

    await expect(page).toHaveURL('/me')
  })

  test('resend issues a usable new code, blocked by a cooldown until it elapses', async ({
    page,
  }) => {
    // src/features/auth/useResendCooldown.ts: fixed 60s, not configurable —
    // this test genuinely waits it out to exercise a real resend rather
    // than only asserting the disabled state.
    test.setTimeout(90_000)

    const email = freshEmail('auth-resend')

    await page.goto('/login')
    await page.getByLabel('Adresse email').fill(email)
    await page.getByRole('button', { name: 'Recevoir le code' }).click()
    await page.getByLabel('Code de connexion').waitFor({ state: 'visible' })

    const resendButton = page.getByRole('button', { name: /Renvoyer un code/ })
    await expect(resendButton).toBeDisabled()
    await expect(resendButton).toHaveText(/Renvoyer un code \(\d+s\)/)

    // Wait out the cooldown, then resend — a fresh code should be usable to
    // complete login.
    await expect(resendButton).toBeEnabled({ timeout: 65_000 })
    await expect(resendButton).toHaveText('Renvoyer un code')
    const resendSentAt = Date.now()
    await resendButton.click()

    const resentCode = await getLatestOtpCode(email, resendSentAt)
    await page.getByLabel('Code de connexion').fill(resentCode)
    await page.getByRole('button', { name: 'Valider' }).click()

    // Fresh account: the nickname step appears (no display_name yet, same
    // as loginAs()) before LoginPage navigates away.
    await skipNicknameStepIfShown(page)
  })
})
