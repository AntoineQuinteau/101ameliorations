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
