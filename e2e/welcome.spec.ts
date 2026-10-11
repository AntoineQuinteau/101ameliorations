import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './support/login'
import { staffEmail } from './support/staff'

// First-visit welcome dialog (spec §6.1). The rest of the suite starts every
// context with it already "seen" (playwright.config.ts `use.storageState`); this
// spec starts from a genuinely fresh browser instead.
test.use({ storageState: { cookies: [], origins: [] } })

const SEEN_KEY = '101ameliorations:welcome-seen'

const welcomeDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Bienvenue sur 101améliorations' })

// Focus moves to the title in the same effect pass that registers the Escape
// listener, so waiting for it is what makes a key press safe.
const waitUntilReady = (page: Page) =>
  expect(page.getByRole('heading', { name: 'Bienvenue sur 101améliorations' })).toBeFocused()

const isSeen = (page: Page) => page.evaluate((key) => localStorage.getItem(key), SEEN_KEY)

test.describe('first-visit welcome dialog', () => {
  test('shows on first visit, closes with the primary button and stays closed after a reload', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(welcomeDialog(page)).toBeVisible()
    await expect(welcomeDialog(page)).toContainText('sans mot de passe')
    // Never stacked with the PWA install banner (the iOS hint shows on the
    // iPhone project).
    await expect(page.getByText("Sur l'écran d'accueil")).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Se connecter ou créer un compte' })).toBeVisible()

    await page.getByRole('button', { name: 'Voir la carte' }).click()
    await expect(welcomeDialog(page)).toHaveCount(0)
    expect(await isSeen(page)).toBe('1')

    await page.reload()
    await expect(page.getByRole('button', { name: 'À propos' })).toBeVisible()
    await expect(welcomeDialog(page)).toHaveCount(0)
  })

  test('Escape closes it and counts as seen', async ({ page }) => {
    await page.goto('/')
    await expect(welcomeDialog(page)).toBeVisible()
    await waitUntilReady(page)
    await page.keyboard.press('Escape')
    await expect(welcomeDialog(page)).toHaveCount(0)
    expect(await isSeen(page)).toBe('1')
  })

  test('the login link goes to /login and the dialog does not come back on the map', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Se connecter ou créer un compte' }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(welcomeDialog(page)).toHaveCount(0)

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'À propos' })).toBeVisible()
    await expect(welcomeDialog(page)).toHaveCount(0)
  })

  test('can be reopened from the About sheet, and focus goes back to its button', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Voir la carte' }).click()

    const aboutButton = page.getByRole('button', { name: 'À propos' })
    await aboutButton.click()
    await page.getByRole('button', { name: 'Comment ça marche ?' }).click()
    await expect(welcomeDialog(page)).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'À propos' })).toHaveCount(0)

    await waitUntilReady(page)
    await page.keyboard.press('Escape')
    await expect(welcomeDialog(page)).toHaveCount(0)
    await expect(aboutButton).toBeFocused()
  })

  test('does not show on other routes, and visiting them does not mark it seen', async ({
    page,
  }) => {
    for (const path of [
      '/k/00000000-0000-0000-0000-000000000000',
      '/login',
      '/new',
      '/confidentialite',
      '/mentions-legales',
    ]) {
      await page.goto(path)
      await expect(page.locator('body')).not.toContainText('Bienvenue sur 101améliorations')
      expect(await isSeen(page)).toBeNull()
    }

    await page.goto('/')
    await expect(welcomeDialog(page)).toBeVisible()
  })

  test('is not shown to a signed-in user', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('moderator'))
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'À propos' })).toBeVisible()
    await expect(welcomeDialog(page)).toHaveCount(0)
  })
})
