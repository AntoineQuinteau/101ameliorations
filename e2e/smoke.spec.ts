import { test, expect } from '@playwright/test'
import { dismissInstallBanner } from './support/dismissInstallBanner'

// Throwaway: only exists to prove the configured browser executable
// actually launches before building the real specs. Safe to keep — cheap
// and catches a broken browser/config combo immediately.
test('map page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/101am/i)
})

// Spec §6.1 follow-up: the maps.me-style icon control set. Covers presence
// and basic interaction, not visual layout (see docs/plans — manual check
// on a real phone covers overlap/positioning).
test('map floating controls are present and interactive', async ({ page }) => {
  await page.goto('/')
  await dismissInstallBanner(page)

  const layerButton = page.getByRole('button', { name: 'Vue satellite' })
  const filtersButton = page.getByRole('button', { name: 'Filtres' })
  // exact: true — "Zoomer" would otherwise substring-match "Dézoomer" too.
  const zoomInButton = page.getByRole('button', { name: 'Zoomer', exact: true })
  const zoomOutButton = page.getByRole('button', { name: 'Dézoomer' })
  const locateButton = page.getByRole('button', { name: 'Me localiser' })

  await expect(layerButton).toBeVisible()
  await expect(filtersButton).toBeVisible()
  await expect(zoomInButton).toBeVisible()
  await expect(zoomOutButton).toBeVisible()
  await expect(locateButton).toBeVisible()
  await expect(page.getByRole('link', { name: 'Se connecter' })).toBeVisible()

  // Layer toggle keeps a stable accessible name (see MapLayerToggle's
  // docblock on why — a toggle's name shouldn't flip with its own pressed
  // state) and instead communicates the switch via aria-pressed.
  await expect(layerButton).toHaveAttribute('aria-pressed', 'false')
  await layerButton.click()
  await expect(layerButton).toHaveAttribute('aria-pressed', 'true')

  // Zoom buttons actually drive the Leaflet map, not just render: the
  // initial zoom is 10 (INITIAL_MAP_ZOOM) and the configured minimum is 8
  // (MIN_MAP_ZOOM, src/config/serviceArea.ts) — enough zoom-outs reach it
  // and the button disables itself there, same as the "+" button at the max.
  // Leaflet's zoomOut() animates (~250ms, longer under CI load) and a
  // second call while that animation is still running is a no-op rather
  // than queued, so clicking in a tight loop with no wait can swallow
  // clicks and get stuck short of the minimum. expect.poll retries the
  // click itself (not just the assertion) until the button actually reaches
  // `disabled`, which tolerates however many of those clicks land — a short
  // per-click timeout (rather than Playwright's default) keeps a click that
  // lands just as the button disables from hanging until the button becomes
  // enabled again, which it never will.
  await expect(zoomOutButton).toBeEnabled()
  await expect
    .poll(
      async () => {
        await zoomOutButton.click({ timeout: 1_000 }).catch(() => {})
        return zoomOutButton.isDisabled()
      },
      { timeout: 10_000 },
    )
    .toBe(true)
})

// "À propos" sheet (spec §6.1): the one entry point to the export and the
// legal/privacy pages, replacing the three footer chips.
test('about sheet opens from the map and links to export, legal and privacy pages', async ({
  page,
}) => {
  await page.goto('/')
  await dismissInstallBanner(page)

  // The old footer chips are gone; their targets now live in the sheet.
  await expect(page.getByRole('link', { name: 'Mentions légales' })).toHaveCount(0)

  const aboutButton = page.getByRole('button', { name: 'À propos' })
  await aboutButton.click()
  await expect(aboutButton).toHaveAttribute('aria-pressed', 'true')

  await expect(page.getByRole('link', { name: /Export des données/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mentions légales' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Politique de confidentialité' })).toBeVisible()

  // Escape closes it.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('link', { name: 'Mentions légales' })).toHaveCount(0)

  await aboutButton.click()
  await page.getByRole('link', { name: 'Mentions légales' }).click()
  await expect(page).toHaveURL(/\/mentions-legales$/)
})

test('filters panel links to the data export', async ({ page }) => {
  await page.goto('/')
  await dismissInstallBanner(page)

  await page.getByRole('button', { name: 'Filtres' }).click()
  await page.getByRole('link', { name: /Télécharger toutes les données/ }).click()
  await expect(page).toHaveURL(/\/export$/)
})

test('staff admin shortcut is not offered to a signed-out visitor', async ({ page }) => {
  await page.goto('/')
  await dismissInstallBanner(page)

  // AdminShortcut renders nothing until auth has resolved, so a count of 0 right
  // after goto proves nothing: wait for something that only appears afterwards.
  await expect(page.getByRole('link', { name: 'Se connecter' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Administration/ })).toHaveCount(0)
})
