import { test, expect } from '@playwright/test'
import { loginAs } from './support/login'

const ADMIN_EMAIL = 'seed-admin@101ameliorations.test'
const MODERATOR_EMAIL = 'seed-moderator@101ameliorations.test'

/**
 * /admin (spec §6.6). The roles tab is admin-only — see
 * src/features/admin/AdminPage.tsx's `isAdmin = role === 'admin'` gate,
 * which conditionally renders both the "Rôles" tab button and its content.
 */
test.describe('admin', () => {
  test('admin sees the klash table, triage queue, and roles tab', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, ADMIN_EMAIL)

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

    // Klash table (default tab).
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.locator('tbody tr').first()).toBeVisible()

    // Triage queue tab.
    await page.getByRole('button', { name: 'À trier' }).click()
    await expect(
      page.getByText('Signalements « nouveau » depuis plus de 7 jours, sans suite pour le moment.'),
    ).toBeVisible()

    // Roles tab: visible and functional for admin. RoleManagement has no
    // <h2> of its own (fr.admin.roles.title is defined but unused there —
    // see the AdminPage tab button, which already says "Rôles"), so assert
    // on its search form instead.
    const rolesTabButton = page.getByRole('button', { name: 'Rôles' })
    await expect(rolesTabButton).toBeVisible()
    await rolesTabButton.click()
    await expect(page.getByLabel('Adresse email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rechercher' })).toBeVisible()
  })

  test('moderator does not see the roles tab', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, MODERATOR_EMAIL)

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

    // Klash table and triage queue are still visible for a moderator...
    await expect(page.getByRole('button', { name: 'Signalements' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'À trier' })).toBeVisible()

    // ...but the roles tab must not be, per the permissions table (spec §2:
    // "Gérer les rôles" is admin-only).
    await expect(page.getByRole('button', { name: 'Rôles' })).toHaveCount(0)
  })
})
