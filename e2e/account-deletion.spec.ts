import { test, expect } from '@playwright/test'
import { dismissInstallBanner } from './support/dismissInstallBanner'
import { loginAs } from './support/login'

function freshEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@101ameliorations.test`
}

/**
 * RGPD account deletion (spec §6.5, §9 step 9): a fresh account logs in,
 * goes to /me, triggers the two-step confirm (MePage's `isConfirmingDelete`
 * state — see src/features/me/MePage.tsx), confirms, and ends up signed out
 * with /me now redirecting to /login (RequireAuth, src/features/auth/
 * RequireAuth.tsx).
 */
test('delete my account end to end', async ({ page }) => {
  const email = freshEmail('account-deletion')

  await page.goto('/login')
  await loginAs(page, email)

  await page.goto('/me')
  await dismissInstallBanner(page)
  await expect(page.getByRole('heading', { name: 'Mon espace' })).toBeVisible()

  await page.getByRole('button', { name: 'Supprimer mon compte…' }).click()

  // Two-step confirm: the trigger button is replaced by an explicit prompt
  // and a confirm/cancel pair, not an immediate delete.
  await expect(
    page.getByText('Confirmez-vous la suppression définitive de votre compte ?'),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Oui, supprimer définitivement' }).click()

  // MePage navigates to '/' only once the delete RPC has actually resolved
  // (see its handleDeleteAccount — same "navigate in onSuccess" rule as
  // KlashDetailPage's delete, per docs/handoff.md's step-7 pièges).
  await expect(page).toHaveURL('/', { timeout: 15_000 })

  // handleDeleteAccount navigates to '/' *then* awaits signOut() — so
  // landing on '/' doesn't yet guarantee the client-side session is
  // cleared. Wait for AuthBadge's "Se connecter" link (src/features/map/
  // AuthBadge.tsx), which only renders once `user` is actually null, before
  // relying on the signed-out state for the next navigation — otherwise
  // going to /me can race signOut() and still find a (stale) session.
  await expect(page.getByRole('link', { name: 'Se connecter' })).toBeVisible({ timeout: 15_000 })

  // Signed-out state: /me is a RequireAuth route, so it now bounces to
  // /login instead of rendering.
  await page.goto('/me')
  await expect(page).toHaveURL(/\/login/)
})
