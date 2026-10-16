import { test, expect, type Page } from '@playwright/test'
import { INITIAL_MAP_CENTER } from '../src/config/serviceArea'
import { dismissInstallBanner } from './support/dismissInstallBanner'
import { stubKlashRow } from './support/stubKlashRow'

// Spec §6.1: the map's filters. The klash list is stubbed in every test, so
// the counts are known whatever the database holds.

const [LAT, LNG] = INITIAL_MAP_CENTER

async function stubKlashes(page: Page, rows: ReturnType<typeof stubKlashRow>[]) {
  await page.route('**/rest/v1/rpc/klashes_in_bbox*', (route) => route.fulfill({ json: rows }))
}

/** The live count: next to the reset button on desktop, on the sheet's main
 * button on mobile (the sheet hides the map the count describes). */
function resultsCount(page: Page, isMobile: boolean, count: number) {
  return isMobile
    ? page.getByRole('button', { name: `Voir les ${count} signalements` })
    : page.getByText(`${count} signalements affichés`)
}

test('an empty selection shows everything, a chip narrows, reset restores', async ({
  page,
  isMobile,
}) => {
  await stubKlashes(page, [
    stubKlashRow(LAT, LNG),
    stubKlashRow(LAT + 0.01, LNG, {
      id: '00000000-0000-4000-8000-000000000003',
      category: 'category_2',
    }),
  ])
  await page.goto('/')
  await dismissInstallBanner(page)

  await page.getByRole('button', { name: 'Filtres' }).click()
  const reset = page.getByRole('button', { name: 'Réinitialiser' })

  await expect(resultsCount(page, isMobile, 2)).toBeVisible()
  await expect(reset).toBeDisabled()
  // The map never holds these two statuses, so there is no chip for them.
  await expect(page.getByRole('button', { name: 'Rejeté' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Doublon' })).toHaveCount(0)

  const chip = page.getByRole('button', { name: 'Obstacle sur la piste' })
  await expect(chip).toHaveAttribute('aria-pressed', 'false')
  await chip.click()
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/[?&]category=category_2(&|$)/)
  await expect(
    isMobile
      ? page.getByRole('button', { name: 'Voir le signalement' })
      : page.getByText('1 signalement affiché'),
  ).toBeVisible()

  await expect(reset).toBeEnabled()
  await reset.click()
  await expect(reset).toBeDisabled()
  await expect(chip).toHaveAttribute('aria-pressed', 'false')
  await expect(page).not.toHaveURL(/category=/)
  await expect(resultsCount(page, isMobile, 2)).toBeVisible()
})

test('closing the mobile sheet puts focus back on the filters button', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the desktop card is covered by the next test')

  await stubKlashes(page, [stubKlashRow(LAT, LNG)])
  await page.goto('/')
  await dismissInstallBanner(page)

  await page.getByRole('button', { name: 'Filtres' }).click()
  const sheet = page.getByRole('dialog', { name: 'Filtres' })
  await expect(sheet).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: 'Filtres' })).toBeFocused()
})

test('the desktop card closes with its close button or Escape', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the mobile sheet is covered by the previous test')

  await stubKlashes(page, [stubKlashRow(LAT, LNG)])
  await page.goto('/')
  await dismissInstallBanner(page)

  // The card stays mounted while closed, so its state is read off the
  // button that toggles it rather than off the card's own visibility.
  const filtersButton = page.getByRole('button', { name: 'Filtres' })
  await filtersButton.click()
  await expect(filtersButton).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Fermer' }).click()
  await expect(filtersButton).toHaveAttribute('aria-pressed', 'false')
  await expect(filtersButton).toBeFocused()

  await filtersButton.click()
  await expect(filtersButton).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(filtersButton).toHaveAttribute('aria-pressed', 'false')
  await expect(filtersButton).toBeFocused()
})

// Escape closes one layer at a time (see `useEscapeKey`): the klash detail modal
// opened over the map first, then the filters card left open under it.
test('Escape closes the klash modal before the desktop card under it', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the klash modal and the filters card are desktop only')

  const row = stubKlashRow(LAT, LNG)
  // Photos, comments, status history… all empty; registered first so the more
  // specific routes below win.
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }))
  await stubKlashes(page, [row])
  await page.route('**/rest/v1/klashes_public*', (route) => route.fulfill({ json: row }))
  await page.goto('/')
  await dismissInstallBanner(page)

  const filtersButton = page.getByRole('button', { name: 'Filtres' })
  await filtersButton.click()
  await expect(filtersButton).toHaveAttribute('aria-pressed', 'true')

  await page.locator('.leaflet-marker-icon.leaflet-interactive').first().click()
  const modal = page.getByRole('dialog', { name: 'Détail du signalement' })
  await expect(modal).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
  await expect(filtersButton).toHaveAttribute('aria-pressed', 'true')

  await page.keyboard.press('Escape')
  await expect(filtersButton).toHaveAttribute('aria-pressed', 'false')
})

test('hovering a marker still previews it while the desktop card is open', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'no hover on touch, and the mobile sheet covers the map')

  await stubKlashes(page, [stubKlashRow(LAT, LNG)])
  await page.goto('/')
  await dismissInstallBanner(page)

  const filtersButton = page.getByRole('button', { name: 'Filtres' })
  await filtersButton.click()
  await expect(filtersButton).toHaveAttribute('aria-pressed', 'true')

  await page.locator('.leaflet-marker-icon.leaflet-interactive').first().hover()
  await expect(page.getByRole('heading', { name: 'Klash de test' })).toBeVisible()
})

// In a window too narrow for the centred preview to clear the filters card,
// it shifts to the right of the card instead of covering the card's footer.
test('the hover preview stays clear of the open desktop card', async ({ page, isMobile }) => {
  test.skip(isMobile, 'no hover on touch, and the mobile sheet covers the map')

  await page.setViewportSize({ width: 1024, height: 640 })
  await stubKlashes(page, [stubKlashRow(LAT, LNG)])
  await page.goto('/')
  await dismissInstallBanner(page)

  await page.getByRole('button', { name: 'Filtres' }).click()
  const closeButton = page.getByRole('button', { name: 'Fermer' })
  await expect(closeButton).toBeVisible()

  await page.locator('.leaflet-marker-icon.leaflet-interactive').first().hover()
  const previewTitle = page.getByRole('heading', { name: 'Klash de test' })
  await expect(previewTitle).toBeVisible()

  // The close button sits at the card's right edge, the title at the
  // preview's left edge.
  const closeBox = await closeButton.boundingBox()
  const titleBox = await previewTitle.boundingBox()
  if (!closeBox || !titleBox) throw new Error('filters card or preview not laid out')
  expect(titleBox.x).toBeGreaterThan(closeBox.x + closeBox.width)
})

test('a period preset in the URL selects its own chip', async ({ page, isMobile }) => {
  await stubKlashes(page, [
    stubKlashRow(LAT, LNG, { created_at: new Date().toISOString() }),
    stubKlashRow(LAT + 0.01, LNG, { id: '00000000-0000-4000-8000-000000000003' }),
  ])
  await page.goto('/?since=7d')
  await dismissInstallBanner(page)

  await page.getByRole('button', { name: 'Filtres (actifs)' }).click()
  await expect(page.getByRole('button', { name: '7 derniers jours' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Toute période' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(
    isMobile
      ? page.getByRole('button', { name: 'Voir le signalement' })
      : page.getByText('1 signalement affiché'),
  ).toBeVisible()
})

test('the map says so when its filters hide every klash, and offers to reset', async ({ page }) => {
  await stubKlashes(page, [stubKlashRow(LAT, LNG)])
  await page.goto('/?category=category_2')
  await dismissInstallBanner(page)

  const notice = page.getByRole('status').filter({ hasText: 'Aucun signalement avec ces filtres' })
  await expect(notice).toBeVisible()
  await expect(page.locator('.leaflet-marker-icon.leaflet-interactive')).toHaveCount(0)

  await notice.getByRole('button', { name: 'Réinitialiser' }).click()
  await expect(notice).toBeHidden()
  await expect(page).not.toHaveURL(/category=/)
  await expect(page.locator('.leaflet-marker-icon.leaflet-interactive')).toHaveCount(1)
})

test('an area with no klash at all does not blame the filters', async ({ page }) => {
  await stubKlashes(page, [])
  const loaded = page.waitForResponse('**/rest/v1/rpc/klashes_in_bbox*')
  await page.goto('/?category=category_2')
  await loaded
  await dismissInstallBanner(page)

  await expect(page.getByRole('button', { name: 'Filtres (actifs)' })).toBeVisible()
  await expect(page.getByText('Aucun signalement avec ces filtres')).toHaveCount(0)
})
