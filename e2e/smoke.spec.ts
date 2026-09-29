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

  const layerButton = page.getByRole('button', { name: 'Afficher la vue satellite' })
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

  // Layer toggle flips its accessible name (plan <-> satellite).
  await layerButton.click()
  await expect(page.getByRole('button', { name: 'Afficher le plan' })).toBeVisible()

  // Zoom buttons drive the Leaflet map, not just render — the zoom-out
  // button becomes reachable/disabled at the configured minimum.
  await expect(zoomOutButton).toBeEnabled()
  await zoomOutButton.click()
})
