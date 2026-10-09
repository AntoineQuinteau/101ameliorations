import { test, expect } from '@playwright/test'
import { dismissInstallBanner } from './support/dismissInstallBanner'
import { loginAs, skipNicknameStepIfShown } from './support/login'
import { getLatestOtpCode } from './support/otp'

function freshEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@101ameliorations.test`
}

test.describe('auth', () => {
  test('the email step links to the privacy policy', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /Politique de confidentialité/ })).toBeVisible()
  })

  test('the typed email and ?next= survive a round trip to the privacy policy', async ({
    page,
  }) => {
    const email = freshEmail('auth-roundtrip')

    await page.goto('/login?next=%2Fme')
    await dismissInstallBanner(page)
    await page.getByLabel('Adresse email').fill(email)

    await page.getByRole('link', { name: /Politique de confidentialité/ }).click()
    await expect(page).toHaveURL('/confidentialite')

    // The page was reached from /login, so "Retour" goes back there, not to the map.
    await page.getByRole('link', { name: 'Retour', exact: true }).click()
    await expect(page).toHaveURL('/login?next=%2Fme')
    await expect(page.getByLabel('Adresse email')).toHaveValue(email)

    // The email never ends up in the URL.
    expect(page.url()).not.toContain(encodeURIComponent(email))
    expect(page.url()).not.toContain(email)

    // ?next= is still honoured at the end of the flow, and the stored email is gone.
    await loginAs(page, email)
    await expect(page).toHaveURL('/me')
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0)
  })

  test('"Retour" falls back to the map on a deep link and goes back otherwise', async ({
    page,
  }) => {
    // First entry of the session: no previous in-app page.
    await page.goto('/confidentialite')
    await dismissInstallBanner(page)
    await page.getByRole('link', { name: 'Retour', exact: true }).click()
    await expect(page).toHaveURL('/')

    // A deep link redirected by RequireAuth (`<Navigate replace>`) is still the first
    // entry of the tab: going back would leave the app, so "Retour" goes to the map.
    await page.goto('/me')
    await expect(page).toHaveURL('/login?next=%2Fme')
    await page.getByRole('link', { name: 'Retour', exact: true }).click()
    await expect(page).toHaveURL('/')

    // Reached by client-side navigation from another in-app page: back to that page.
    await page.getByRole('button', { name: 'À propos' }).click()
    await page.locator('a[href="/confidentialite"]').click()
    await expect(page).toHaveURL('/confidentialite')
    await page.getByRole('link', { name: 'Retour', exact: true }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'À propos' })).toBeVisible()
  })

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
