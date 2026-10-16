import { test, expect } from '@playwright/test'
import { loginAs } from './support/login'
import { staffEmail } from './support/staff'

/**
 * /campaigns (spec §6.8): reserved to accounts holding the campaign-manager
 * right (profiles.can_manage_campaigns) or admins, and separate from /admin.
 * The `campaigner` account is a plain `user` with only that right
 * (supabase/seed-e2e.sql).
 */
test.describe('campaigns', () => {
  test('a campaign manager reaches the page from /me, without access to /admin', async ({
    page,
  }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('campaigner'))

    await page.goto('/me')
    await expect(page.getByRole('link', { name: "Accéder à l'administration" })).toHaveCount(0)
    await page.getByRole('link', { name: 'Gérer les campagnes' }).click()
    await expect(page).toHaveURL(/\/campaigns$/)
    await expect(page.getByRole('heading', { name: 'Campagnes' })).toBeVisible()

    // No staff role: /admin stays closed.
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/$/)
  })

  test('a campaign manager creates a link and gets its short URL and QR code', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('campaigner'))
    await page.goto('/campaigns')

    await page.getByRole('button', { name: 'Créer un lien' }).click()
    await page.getByLabel('Émetteur').first().selectOption({ label: "Txirrind'Ola" })

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

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false)
  })

  test('a campaign manager creates a link for a new emitter', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('campaigner'))
    await page.goto('/campaigns')

    await page.getByRole('button', { name: 'Créer un lien' }).click()
    await page.getByLabel('Émetteur').first().selectOption({ label: 'Nouvel émetteur…' })

    // Unique name: the emitter outlives the test, like any created data.
    const unique = `${Date.now()} ${Math.random().toString(36).slice(2, 6)}`
    const name = `Émetteur e2e ${unique}`
    const key = `emetteur-e2e-${unique.replace(' ', '-')}`
    await page.getByLabel('Nom du nouvel émetteur', { exact: true }).fill(name)
    await expect(page.locator('code', { hasText: key })).toBeVisible()

    page.once('dialog', (dialog) => void dialog.accept())
    await page.getByRole('button', { name: 'Créer le lien' }).click()

    const result = page.getByRole('region', { name: 'Lien créé' })
    await expect(result).toBeVisible()
    await expect(result.getByLabel('Adresse courte')).toHaveValue(new RegExp(`/r/${key}$`))

    // The typed label, not the key, is what the lists show.
    const filter = page.getByRole('region', { name: 'Liens' }).getByLabel('Émetteur')
    await expect(filter.locator('option', { hasText: name })).toHaveCount(1)
  })

  test('the QR code of a link opens right under it, one at a time', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('campaigner'))
    await page.goto('/campaigns')

    const list = page.getByRole('region', { name: 'Liens' })
    const flyer = list.getByRole('listitem').filter({ hasText: '/r/txdo-flyer' })
    const papillon = list.getByRole('listitem').filter({ hasText: '/r/cpam-papillon' })
    await expect(flyer.getByRole('button', { name: 'Copier le lien' })).toBeVisible()

    await flyer.getByRole('button', { name: 'QR code' }).click()
    await expect(flyer.getByRole('img', { name: /\/r\/txdo-flyer$/ })).toBeInViewport()

    await papillon.getByRole('button', { name: 'QR code' }).click()
    await expect(papillon.getByRole('img', { name: /\/r\/cpam-papillon$/ })).toBeInViewport()
    await expect(page.getByRole('img', { name: /^QR code de / })).toHaveCount(1)

    // Each unfolded panel has its own way out.
    await papillon.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.getByRole('img', { name: /^QR code de / })).toHaveCount(0)
    await papillon.getByRole('button', { name: 'Modifier' }).click()
    await expect(papillon.getByLabel('Destination')).toBeVisible()
    await papillon.getByRole('button', { name: 'Fermer' }).click()
    await expect(papillon.getByLabel('Destination')).toHaveCount(0)
  })

  test('the Résultats tab shows the funnel per emitter, campaign and link', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('admin'))
    await page.goto('/campaigns')
    await page.getByRole('button', { name: 'Résultats' }).click()

    await expect(page).toHaveURL(/\/campaigns\?tab=results$/)
    await expect(page.getByRole('heading', { name: 'Par émetteur' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Par campagne' })).toBeVisible()
    await expect(
      page
        .getByRole('region', { name: 'Par émetteur' })
        .getByRole('columnheader', { name: 'Klashs', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Par lien' }).getByRole('rowheader', {
        name: /\/r\/txdo-flyer/,
      }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false)
  })

  test('a moderator without the right sees neither the link nor the page', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('moderator'))

    await page.goto('/admin')
    await expect(page.getByRole('button', { name: 'Signalements' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Campagnes' })).toHaveCount(0)

    await page.goto('/me')
    await expect(page.getByRole('link', { name: "Accéder à l'administration" })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Gérer les campagnes' })).toHaveCount(0)

    await page.goto('/campaigns')
    await expect(page).toHaveURL(/\/$/)
  })

  test('anonymous visitors and plain users are sent back to the map', async ({ page }) => {
    await page.goto('/campaigns')
    await expect(page).toHaveURL(/\/$/)

    const email = `e2e-plain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@101ameliorations.test`
    await page.goto('/login')
    await loginAs(page, email)
    await page.goto('/campaigns')
    await expect(page).toHaveURL(/\/$/)
  })
})
