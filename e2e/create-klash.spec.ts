import { test, expect } from '@playwright/test'
import { dismissInstallBanner } from './support/dismissInstallBanner'
import { getLatestOtpCode } from './support/otp'

function freshEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@101ameliorations.test`
}

/**
 * The 4-step creation flow (spec §6.2, acceptance criterion in §9 step 4):
 * position -> duplicates -> form -> submit (with inline login for a signed
 * out user). Opens `/new` with no `?lat=&lng=`, which defaults the pin to
 * Bayonne (src/config/serviceArea.ts's INITIAL_MAP_CENTER), already inside
 * the service area bbox — no need to drag the pin or pick a special point.
 *
 * Uses category_1 ("Trou / bosse ou chaussée abîmée"), not category_7
 * ("Autre (préciser)"), specifically to avoid the required category_other
 * free-text field — a deliberately different complication, out of scope
 * here.
 */
test('create a klash end to end, with inline login for a fresh user', async ({ page }) => {
  const email = freshEmail('create-klash')
  const title = `E2E test klash ${Date.now()}`

  await page.goto('/new')
  await dismissInstallBanner(page)

  // Step 1: position. Bayonne is inside the service area, so "Continuer" is
  // available immediately.
  await expect(page.getByRole('heading', { name: 'Position du problème' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Step 2: duplicates. Nothing seeded at the exact Bayonne centre
  // coordinate within the 50m radius is expected, so this normally
  // auto-skips to the form (DuplicatesStep's onDifferentProblem effect).
  // If something unexpectedly is nearby, take the explicit "different
  // problem" branch rather than fail the whole flow on seed data churn.
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

  // Step 3: form. Category (not category_7), importance, title, description;
  // photos step is optional and skipped entirely by not adding any.
  await page.getByLabel('Catégorie').selectOption('category_1')
  await page.getByRole('button', { name: 'Élevée' }).click()
  await page.getByLabel('Titre').fill(title)
  await page.getByLabel('Description').fill('Signalement créé par le test E2E.')
  await page.getByRole('button', { name: 'Continuer' }).click()

  // Step 4: submit, with inline login (spec §6.2 step 4) since this is a
  // fresh session.
  await expect(page.getByText('Pour envoyer votre signalement, connectez-vous.')).toBeVisible()
  await page.getByLabel('Adresse email').fill(email)
  const sentAt = Date.now()
  await page.getByRole('button', { name: 'Recevoir le code' }).click()

  await page.getByLabel('Code de connexion').waitFor({ state: 'visible' })
  const code = await getLatestOtpCode(email, sentAt)
  await page.getByLabel('Code de connexion').fill(code)
  await page.getByRole('button', { name: 'Valider' }).click()

  // Fresh account: the nickname step normally appears (no display_name yet)
  // — skip it, since the created klash still records author_id and MePage
  // further down doesn't depend on a pseudo. Race it against the submit
  // going straight through, the same way support/login.ts's loginAs()
  // does: SubmitStep decides whether to show it only once both the new
  // session *and* the just-created profile have resolved (see its
  // src/features/newKlash/SubmitStep.tsx effect), which on a fast local
  // Supabase can settle before this test's next action even starts —
  // asserting the nickname step must appear is flaky by construction here.
  //
  // The click itself is also raced against disappearing mid-click: once
  // "Passer" is pressed, SubmitStep immediately fires the pending klash
  // creation (see handleNicknameSkip there), which can swap this whole step
  // out for NewKlashPage's DoneStep fast enough on a local Supabase that
  // Playwright's own actionability wait ("visible, enabled and stable")
  // loses the race and reports the button "detached from the DOM" even
  // though the click had already done its job. A failed click here is
  // therefore not itself a failure — only the assertions below decide that.
  const skipButton = page.getByRole('button', { name: 'Passer' })
  await Promise.race([
    skipButton.waitFor({ state: 'visible' }),
    page.getByRole('heading', { name: 'Signalement envoyé !' }).waitFor({ state: 'visible' }),
  ])
  if (await skipButton.isVisible().catch(() => false)) {
    await skipButton.click({ timeout: 5_000 }).catch(() => {})
  }

  // NewKlashPage's DoneStep (see src/features/newKlash/NewKlashPage.tsx):
  // renders in place rather than redirecting, with a link to view the new
  // klash.
  await expect(page.getByRole('heading', { name: 'Signalement envoyé !' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('Merci, votre signalement a été transmis.')).toBeVisible()

  await page.getByRole('button', { name: 'Voir mon signalement' }).click()

  await expect(page).toHaveURL(/\/k\/[0-9a-f-]+/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByText('Trou / bosse ou chaussée abîmée')).toBeVisible()
  await expect(page.getByText('Importance élevée')).toBeVisible()
  await expect(page.getByText('Nouveau', { exact: true })).toBeVisible()
})
