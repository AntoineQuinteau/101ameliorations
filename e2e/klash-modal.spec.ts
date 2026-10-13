import { test, expect, type Page } from '@playwright/test'
import { INITIAL_MAP_CENTER } from '../src/config/serviceArea'
import { dismissInstallBanner } from './support/dismissInstallBanner'
import { stubKlashRow } from './support/stubKlashRow'

// Spec §6.3: on desktop, a marker click opens the klash detail in a modal over the
// still-mounted map, at the same `/k/:id` URL as the full page. Everything is stubbed,
// so the spec needs no seed data.

const [lat, lng] = INITIAL_MAP_CENTER
const row = stubKlashRow(lat, lng)
const klashUrl = new RegExp(`/k/${row.id}$`)

async function stubBackend(page: Page) {
  // Photos, comments, status history, confirmations… all empty; registered first so
  // the more specific routes below win.
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/rpc/klashes_in_bbox*', (route) => route.fulfill({ json: [row] }))
  await page.route('**/rest/v1/klashes_public*', (route) => route.fulfill({ json: row }))
}

const modal = (page: Page) => page.getByRole('dialog', { name: 'Détail du signalement' })

async function clickMarker(page: Page) {
  await page.locator('.leaflet-marker-icon.leaflet-interactive').first().click()
}

/** Opens `/` and clicks the marker. Doesn't wait for the modal: on mobile there is none. */
async function openFromMap(page: Page) {
  await page.goto('/')
  await dismissInstallBanner(page)
  await clickMarker(page)
}

async function openModalFromMap(page: Page) {
  await openFromMap(page)
  await expect(modal(page)).toBeVisible()
}

test.describe('klash detail modal', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page)
  })

  test.describe('desktop', () => {
    test.skip(({ isMobile }) => isMobile, 'fine pointer only')

    test('a marker click opens the detail over the map at /k/:id', async ({ page }) => {
      await openModalFromMap(page)
      await expect(page).toHaveURL(klashUrl)
      await expect(modal(page)).toContainText(row.title)
      await expect(page.locator('.leaflet-container').first()).toBeAttached()
    })

    test('Escape, the close button and Back all return to the map', async ({ page }) => {
      await openModalFromMap(page)
      await page.keyboard.press('Escape')
      await expect(modal(page)).toHaveCount(0)
      await expect(page).toHaveURL(/\/$/)

      await clickMarker(page)
      await expect(modal(page)).toBeVisible()
      await modal(page).getByRole('button', { name: 'Fermer' }).click()
      await expect(modal(page)).toHaveCount(0)
      await expect(page).toHaveURL(/\/$/)

      await clickMarker(page)
      await expect(modal(page)).toBeVisible()
      await page.goBack()
      await expect(modal(page)).toHaveCount(0)
      await expect(page).toHaveURL(/\/$/)
    })

    test('closing keeps the map view and the filters query', async ({ page }) => {
      await page.goto('/?status=new')
      await dismissInstallBanner(page)
      const marker = page.locator('.leaflet-marker-icon.leaflet-interactive').first()
      await expect(marker).toBeVisible()
      const before = await marker.boundingBox()

      await marker.click()
      await expect(modal(page)).toBeVisible()
      await page.keyboard.press('Escape')

      await expect(page).toHaveURL(/\/\?status=new$/)
      await expect(marker).toBeVisible()
      expect(await marker.boundingBox()).toEqual(before)
    })

    test('a direct load is the full page, not a modal', async ({ page }) => {
      await page.goto(`/k/${row.id}`)
      await expect(page.getByRole('link', { name: 'Retour' })).toBeVisible()
      await expect(modal(page)).toHaveCount(0)
      // Only the detail's mini map, not the main map.
      await expect(page.locator('.leaflet-container')).toHaveCount(1)
    })

    test('a reload keeps the modal open', async ({ page }) => {
      await openModalFromMap(page)
      await page.reload()
      await expect(modal(page)).toBeVisible()
    })
  })

  test.describe('mobile', () => {
    test.skip(({ isMobile }) => !isMobile, 'touch only')

    test('tap, preview card, then the full page', async ({ page }) => {
      await openFromMap(page)
      await page.getByRole('link', { name: 'Voir le détail' }).click()
      await expect(page).toHaveURL(klashUrl)
      await expect(modal(page)).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Retour' })).toBeVisible()
    })
  })
})
