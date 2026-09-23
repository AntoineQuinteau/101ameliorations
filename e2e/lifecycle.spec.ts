import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './support/login'

const MODERATOR_EMAIL = 'seed-moderator@101ameliorations.test'
const AUTHORITY_EMAIL = 'seed-authority@101ameliorations.test'

/**
 * Opens `/admin`'s klash table, filters to `status = new`, jumps to the
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
  await expect(page.getByRole('table')).toBeVisible()

  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()

  const lastPageButton = page.getByRole('button', { name: 'Page suivante' })
  while (await lastPageButton.isEnabled()) {
    // The click that lands on the last page can disable this same button
    // before Playwright's actionability wait confirms it as "enabled" for
    // the click, which then retries against a now-permanently-disabled
    // target until the test's 30s timeout. A short timeout plus swallowing
    // that one failure is safe here: either the click went through before
    // the button disabled (the common case), or it didn't and the loop
    // condition below re-reads `isEnabled()` and simply exits.
    await lastPageButton.click({ timeout: 5000 }).catch(() => {})
    await expect(rows.first()).toBeVisible()
  }

  const count = await rows.count()
  const index = count - 1 - indexFromEnd
  if (index < 0) {
    throw new Error(
      `Last page of 'new' klashes has only ${count} rows, need index ${indexFromEnd} from the end`,
    )
  }
  const href = await rows.nth(index).getByRole('link').getAttribute('href')
  if (!href) throw new Error(`No href on row ${index} of the admin klash table's last page`)
  return href
}

test.describe('lifecycle', () => {
  test('moderator triages a new klash to rejected', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, MODERATOR_EMAIL)

    const klashUrl = await findNewKlashUrl(page, 0)
    await page.goto(klashUrl)

    await expect(page.getByText('Nouveau', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Changer le statut' }).click()
    await page.getByLabel('Nouveau statut').selectOption('rejected')
    await page.getByLabel('Note (facultative)').fill('E2E : rejeté par le test lifecycle.')
    await page.getByRole('button', { name: 'Valider' }).click()

    // Status badge updates.
    await expect(page.getByText('Rejeté', { exact: true })).toBeVisible()

    // Status history updates with the new transition line and note.
    await expect(page.getByText('Nouveau → Rejeté')).toBeVisible()
    await expect(page.getByText('E2E : rejeté par le test lifecycle.')).toBeVisible()
  })

  test('authority acknowledges a new klash', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, AUTHORITY_EMAIL)

    // A different klash than the moderator test above, to avoid the two
    // tests racing to change the same row's status (each finds its own
    // "first new klash" independently and could otherwise collide).
    const klashUrl = await findNewKlashUrl(page, 1)
    await page.goto(klashUrl)

    await expect(page.getByText('Nouveau', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Changer le statut' }).click()
    await page.getByLabel('Nouveau statut').selectOption('acknowledged')
    await page.getByLabel('Note (facultative)').fill('E2E : pris en compte par le test lifecycle.')
    await page.getByRole('button', { name: 'Valider' }).click()

    await expect(page.getByText('Pris en compte', { exact: true })).toBeVisible()

    await expect(page.getByText('Nouveau → Pris en compte')).toBeVisible()
    await expect(page.getByText('E2E : pris en compte par le test lifecycle.')).toBeVisible()
  })
})
