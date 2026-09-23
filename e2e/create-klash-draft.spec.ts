import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { dismissInstallBanner } from './support/dismissInstallBanner'

const currentDir = dirname(fileURLToPath(import.meta.url))
// A real PNG already in the repo (public/pwa-192x192.png) — no need for a
// dedicated binary test fixture just to exercise the photo pipeline.
const FIXTURE_PHOTO = resolve(currentDir, '../public/pwa-192x192.png')

/**
 * Draft auto-save/restore (docs/plans/ameliorations-3-brouillon.md): filling
 * in part of a report, leaving without submitting, and getting it back via
 * the map's "déclaration en cours" chip — then discarding it explicitly.
 * Mirrors create-klash.spec.ts's step 1/2 setup, but never reaches step 4
 * (submit): the whole point here is a report that's never sent.
 */
test('an abandoned report draft is offered back on the map, and can be discarded', async ({
  page,
}) => {
  const title = `E2E draft klash ${Date.now()}`

  await page.goto('/new')
  await dismissInstallBanner(page)

  // Step 1: position. Bayonne (the default centre) is inside the service area.
  await expect(page.getByRole('heading', { name: 'Position du problème' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Step 2: duplicates — same auto-skip race as create-klash.spec.ts, for
  // the same reason (nothing seeded is expected at this exact point, but
  // seed data can change).
  const differentProblemButton = page.getByRole('button', {
    name: "Non, c'est un autre problème → continuer",
  })
  await Promise.race([
    page.getByRole('heading', { name: 'Décrire le problème' }).waitFor({ state: 'visible' }),
    differentProblemButton.waitFor({ state: 'visible' }),
  ])
  if (await differentProblemButton.isVisible().catch(() => false)) {
    await differentProblemButton.click()
  }
  await expect(page.getByRole('heading', { name: 'Décrire le problème' })).toBeVisible()

  // Step 3: form — enough to make the draft worth keeping, plus a photo.
  // setInputFiles targets the (visually hidden but still attached) gallery
  // input directly, regardless of which UI path would normally open it.
  await page.getByLabel('Catégorie').selectOption('category_1')
  await page.getByLabel('Titre').fill(title)
  await page.getByLabel('Description').fill('Brouillon de test E2E.')
  await page.locator('input[type="file"][multiple]').setInputFiles(FIXTURE_PHOTO)
  await expect(page.getByRole('button', { name: 'Retirer cette photo' })).toBeVisible()

  // Wait on the real postcondition, not a timeout: the debounced metadata
  // write (500ms) can land before setInputFiles finishes compressing and
  // reading the photo, so a wait keyed on 'klash-draft' merely existing
  // proves nothing about the photo specifically — poll until its `photos`
  // array is non-empty instead.
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('klash-draft')
    if (!raw) return false
    try {
      return (JSON.parse(raw) as { photos: unknown[] }).photos.length > 0
    } catch {
      return false
    }
  })

  // Cancel, and choose to keep the draft.
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByRole('heading', { name: 'Abandonner la déclaration ?' })).toBeVisible()
  await page.getByRole('button', { name: 'Garder le brouillon' }).click()

  // Back on the map, the chip offers to resume it.
  const draftChip = page.getByRole('button', { name: 'Déclaration en cours — reprendre' })
  await expect(draftChip).toBeVisible()
  await draftChip.click()

  // No explicit ?lat=&lng= is involved (the chip links to /new?draft=1), so
  // the draft restores immediately — straight to the step it was saved at
  // ('form') — rather than through the resume-or-start-new prompt.
  await expect(page.getByRole('heading', { name: 'Décrire le problème' })).toBeVisible()
  await expect(page.getByLabel('Titre')).toHaveValue(title)
  await expect(page.getByLabel('Description')).toHaveValue('Brouillon de test E2E.')
  await expect(page.getByRole('button', { name: 'Retirer cette photo' })).toBeVisible()

  // Cancel again, this time discarding it for good.
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByRole('heading', { name: 'Abandonner la déclaration ?' })).toBeVisible()
  await page.getByRole('button', { name: 'Supprimer la déclaration' }).click()

  await expect(draftChip).not.toBeVisible()
})
