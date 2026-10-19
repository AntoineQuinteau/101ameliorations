import { test, expect, type Page } from '@playwright/test'
import { INITIAL_MAP_CENTER } from '../src/config/serviceArea'
import { dismissInstallBanner } from './support/dismissInstallBanner'
import { stubKlashRow } from './support/stubKlashRow'

// Spec §6.3: the detail page names the klash's commune under the mini map,
// and shows nothing there for a point outside every known commune.
// Everything is stubbed, so the spec needs no seed data.

const [lat, lng] = INITIAL_MAP_CENTER

async function openDetail(page: Page, overrides: Record<string, unknown>) {
  const row = stubKlashRow(lat, lng, overrides)
  // Photos, comments, status history, confirmations… all empty; registered
  // first so the more specific route below wins.
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/klashes_public*', (route) => route.fulfill({ json: row }))
  await page.goto(`/k/${row.id}`)
  await dismissInstallBanner(page)
  await expect(page.getByRole('heading', { name: 'Klash de test' })).toBeVisible()
}

test('names the commune under the mini map', async ({ page }) => {
  await openDetail(page, { insee_code: '64102', commune_name: 'Bayonne' })
  await expect(page.getByText('Commune : Bayonne')).toBeVisible()
})

test('shows no commune for a point outside every known commune', async ({ page }) => {
  await openDetail(page, {})
  await expect(page.getByText(/^Commune :/)).toHaveCount(0)
})
