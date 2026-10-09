import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './support/login'
import { staffEmail } from './support/staff'

/** The header badges (category, importance, current status). The status
 * timeline also renders status badges, so current-status assertions are
 * scoped here to stay unambiguous. */
function headerBadges(page: Page) {
  return page.getByRole('group', { name: 'Catégorie, importance et statut' })
}

/** The steps of the "Historique des statuts" timeline, oldest first. */
function historySteps(page: Page) {
  return page.getByRole('region', { name: 'Historique des statuts' }).getByRole('listitem')
}

/**
 * Opens `/admin`'s klash listing (table or cards), filters to `status = new`, jumps to the
 * LAST page, and returns the `/k/:id` URL of the Nth-from-the-end matching
 * klash via its title link.
 *
 * Uses the admin table rather than the "à trier" triage queue
 * (spec §6.6): the queue only lists klashs `new` for more than 7 days
 * (src/features/admin/TriageQueue.tsx), which the seed data may or may not
 * satisfy depending on when it was last generated — the table's status
 * filter has no such age dependency and the seed always has plenty of
 * `new` klashs (~630 seeded, spec §2 step-2 acceptance criterion).
 *
 * The last page specifically, not the first: the table sorts newest first,
 * so the first page is exactly where a klash created moments ago by
 * create-klash.spec.ts (running concurrently, spec §9's Playwright suite
 * has no ordering between files) would land — this collided in practice,
 * with this spec re-triaging a klash create-klash.spec.ts had just created
 * and was still asserting against. The oldest `new` klashes (the seed data,
 * generated well before any test run) are never a moving target.
 */
async function findNewKlashUrl(page: Page, indexFromEnd: number): Promise<string> {
  await page.goto('/admin')
  await page.getByLabel('Statut').selectOption('new')

  // One link per klash in either layout: a table row from 768px, a card
  // below (both are in the DOM, CSS shows one — hence `:visible`).
  const rows = page.locator('a[href^="/k/"]:visible')
  await expect(rows.first()).toBeVisible()

  // Checking isEnabled() before each click races the click's own
  // actionability wait: the click that actually lands on the last page can
  // disable the button while that same click is still retrying (page
  // re-render mid-transition), and Playwright then keeps retrying against
  // an element that has legitimately become permanently disabled until the
  // *test's* 30s timeout — not this loop's condition — kills it. Capping
  // the click's own timeout well below that and swallowing that one
  // expected failure fixes it: either the click lands before the button
  // disables (the common case), or it doesn't and the loop's next
  // isEnabled() check exits normally.
  const lastPageButton = page.getByRole('button', { name: 'Page suivante' })
  while (await lastPageButton.isEnabled()) {
    await lastPageButton.click({ timeout: 3_000 }).catch(() => {})
    await expect(rows.first()).toBeVisible()
  }

  const count = await rows.count()
  const index = count - 1 - indexFromEnd
  if (index < 0) {
    throw new Error(
      `Last page of 'new' klashes has only ${count} rows, need index ${indexFromEnd} from the end`,
    )
  }
  const href = await rows.nth(index).getAttribute('href')
  if (!href) throw new Error(`No href on row ${index} of the admin klash listing's last page`)
  return href
}

test.describe('lifecycle', () => {
  test('moderator triages a new klash to rejected', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('moderator'))

    const klashUrl = await findNewKlashUrl(page, 0)
    await page.goto(klashUrl)

    await expect(headerBadges(page).getByText('Nouveau', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Changer le statut' }).click()
    await page.getByLabel('Nouveau statut').selectOption('rejected')
    await page.getByLabel('Note (facultative)').fill('E2E : rejeté par le test lifecycle.')
    await page.getByRole('button', { name: 'Valider' }).click()

    // Status badge updates.
    await expect(headerBadges(page).getByText('Rejeté', { exact: true })).toBeVisible()

    // Status history updates: creation step, then the new step (Rejeté)
    // carrying the note — i.e. Nouveau → Rejeté.
    const steps = historySteps(page)
    await expect(steps).toHaveCount(2)
    await expect(steps.nth(0).getByText('Nouveau', { exact: true })).toBeVisible()
    await expect(steps.nth(0).getByText('Signalement créé')).toBeVisible()
    await expect(steps.nth(1).getByText('Rejeté', { exact: true })).toBeVisible()
    await expect(steps.nth(1).getByText('E2E : rejeté par le test lifecycle.')).toBeVisible()
  })

  test('authority acknowledges a new klash', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('authority'))

    // A different klash than the moderator test above, to avoid the two
    // tests racing to change the same row's status (each finds its own
    // "first new klash" independently and could otherwise collide).
    const klashUrl = await findNewKlashUrl(page, 1)
    await page.goto(klashUrl)

    await expect(headerBadges(page).getByText('Nouveau', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Changer le statut' }).click()
    await page.getByLabel('Nouveau statut').selectOption('acknowledged')
    await page.getByLabel('Note (facultative)').fill('E2E : pris en compte par le test lifecycle.')
    await page.getByRole('button', { name: 'Valider' }).click()

    await expect(headerBadges(page).getByText('Pris en compte', { exact: true })).toBeVisible()

    const steps = historySteps(page)
    await expect(steps).toHaveCount(2)
    await expect(steps.nth(0).getByText('Nouveau', { exact: true })).toBeVisible()
    await expect(steps.nth(0).getByText('Signalement créé')).toBeVisible()
    await expect(steps.nth(1).getByText('Pris en compte', { exact: true })).toBeVisible()
    await expect(
      steps.nth(1).getByText('E2E : pris en compte par le test lifecycle.'),
    ).toBeVisible()
  })
})
