import { test, expect } from '@playwright/test'
import { loginAs } from './support/login'
import { staffEmail } from './support/staff'

/**
 * /admin "Campagnes" tab (spec §6.8): reserved to accounts holding the
 * campaign-manager right (profiles.can_manage_campaigns) or admins. The
 * `campaigner` account is a plain `user` with only that right
 * (supabase/seed-e2e.sql).
 */
test.describe('campaigns', () => {
  test('a campaign manager creates a link and gets its short URL and QR code', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('campaigner'))
    await page.goto('/admin')

    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Campagnes' })).toBeVisible()
    // No staff role: none of the moderation tabs.
    await expect(page.getByRole('button', { name: 'Signalements' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'À trier' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Rôles' })).toHaveCount(0)

    await page.getByLabel('Émetteur').first().selectOption({ label: 'Association' })

    // Precision is free text, normalized live.
    const precision = `Dépliant e2e ${Date.now()} ${Math.random().toString(36).slice(2, 6)}`
    await page.getByLabel('Précision').fill(precision)
    await expect(page.getByText('depliant-e2e-', { exact: false }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Créer le lien' }).click()

    const result = page.getByRole('region', { name: 'Lien créé' })
    await expect(result).toBeVisible()
    await expect(result.getByLabel('Adresse courte')).toHaveValue(/\/r\/txdo-depliant/)
    await expect(result.getByRole('img', { name: /^QR code de / })).toBeVisible()
    await expect(result.getByRole('button', { name: 'Télécharger en SVG' })).toBeVisible()
    await expect(result.getByRole('button', { name: 'Télécharger en PNG' })).toBeVisible()
    await expect(result.getByText('2 cm de côté')).toBeVisible()

    // The new link shows up in the list, with its funnel at zero.
    await expect(page.getByRole('status')).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false)
  })

  test('a moderator without the right does not see the Campagnes tab', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('moderator'))
    await page.goto('/admin')
    await expect(page.getByRole('button', { name: 'Signalements' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Campagnes' })).toHaveCount(0)
  })

  test('an admin sees the Campagnes tab', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('admin'))
    await page.goto('/admin?tab=campaigns')
    await expect(page.getByRole('heading', { name: 'Créer un lien' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Synthèse' })).toBeVisible()
  })

  test('anonymous visitors and plain users are sent back to the map', async ({ page }) => {
    await page.goto('/admin?tab=campaigns')
    await expect(page).toHaveURL(/\/$/)

    const email = `e2e-plain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@101ameliorations.test`
    await page.goto('/login')
    await loginAs(page, email)
    await page.goto('/admin?tab=campaigns')
    await expect(page).toHaveURL(/\/$/)
  })
})
