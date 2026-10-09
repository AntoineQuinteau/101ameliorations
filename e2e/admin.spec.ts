import { test, expect } from '@playwright/test'
import { loginAs } from './support/login'
import { staffEmail } from './support/staff'

/**
 * /admin (spec §6.6). The roles tab is admin-only — see
 * src/features/admin/AdminPage.tsx's `isAdmin = role === 'admin'` gate,
 * which conditionally renders both the "Rôles" tab button and its content.
 */
test.describe('admin', () => {
  test('admin sees the klash table, triage queue, and roles tab', async ({ page, isMobile }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('admin'))

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

    // Klash listing (default tab): a table from 768px, a card list below.
    if (isMobile) {
      await expect(page.getByRole('list', { name: 'Signalements' })).toBeVisible()
      await expect(page.getByRole('table')).toBeHidden()
    } else {
      await expect(page.getByRole('table')).toBeVisible()
      await expect(page.locator('tbody tr').first()).toBeVisible()
    }

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
    await loginAs(page, staffEmail('moderator'))

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

    // Klash table and triage queue are still visible for a moderator...
    await expect(page.getByRole('button', { name: 'Signalements' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'À trier' })).toBeVisible()

    // ...but the roles tab must not be, per the permissions table (spec §2:
    // "Gérer les rôles" is admin-only).
    await expect(page.getByRole('button', { name: 'Rôles' })).toHaveCount(0)
  })

  // Both entry points are offered to staff on every device; the route itself
  // is guarded by RequireRole and RLS.
  for (const role of ['admin', 'moderator', 'authority'] as const) {
    test(`${role} can reach /admin from the map shortcut and from /me`, async ({ page }) => {
      await page.goto('/login')
      await loginAs(page, staffEmail(role))
      await page.goto('/')

      await page.getByRole('link', { name: /^Administration/ }).click()
      await expect(page).toHaveURL(/\/admin$/)
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

      await page.goto('/me')
      await page.getByRole('link', { name: "Accéder à l'administration" }).click()
      await expect(page).toHaveURL(/\/admin$/)
    })
  }

  test('/admin fits the screen on every tab and a klash opens from the listing', async ({
    page,
  }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('admin'))
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

    const hasHorizontalScroll = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )

    for (const tab of ['À trier', 'Rôles', 'Signalements']) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      expect(await hasHorizontalScroll()).toBe(false)
    }

    const firstKlash = page.locator('a[href^="/k/"]:visible').first()
    await firstKlash.click()
    await expect(page).toHaveURL(/\/k\//)
  })
})
