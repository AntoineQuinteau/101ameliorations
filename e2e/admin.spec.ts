import { test, expect } from '@playwright/test'
import { loginAs } from './support/login'
import { staffEmail } from './support/staff'

/**
 * /admin (spec §6.6). The roles tab is admin-only — see
 * src/features/admin/AdminPage.tsx's `isAdmin = role === 'admin'` gate,
 * which conditionally renders both the "Rôles" tab button and its content.
 */
test.describe('admin', () => {
  test('admin sees the klash table, triage queue, and roles tab', async ({ page, isMobile }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('admin'))

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

    // Klash listing (default tab): a table from 768px, a card list below.
    if (isMobile) {
      await expect(page.getByRole('list', { name: 'Signalements' })).toBeVisible()
      await expect(page.getByRole('table')).toBeHidden()
    } else {
      await expect(page.getByRole('table')).toBeVisible()
      await expect(page.locator('tbody tr').first()).toBeVisible()
    }

    // Triage queue tab.
    await page.getByRole('button', { name: 'À trier' }).click()
    await expect(
      page.getByText('Signalements « nouveau » depuis plus de 7 jours, sans suite pour le moment.'),
    ).toBeVisible()

    // Roles tab: visible and functional for admin. RoleManagement has no
    // <h2> of its own (fr.admin.roles.title is defined but unused there —
    // see the AdminPage tab button, which already says "Rôles"), so assert
    // on its search form instead.
    const rolesTabButton = page.getByRole('button', { name: 'Rôles' })
    await expect(rolesTabButton).toBeVisible()
    await rolesTabButton.click()
    await expect(page.getByLabel('Adresse email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rechercher' })).toBeVisible()
  })

  test('moderator does not see the roles tab', async ({ page }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('moderator'))

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

    // Klash table and triage queue are still visible for a moderator...
    await expect(page.getByRole('button', { name: 'Signalements' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'À trier' })).toBeVisible()

    // ...but the roles tab must not be, per the permissions table (spec §2:
    // "Gérer les rôles" is admin-only).
    await expect(page.getByRole('button', { name: 'Rôles' })).toHaveCount(0)
  })

  // Both entry points are offered to staff on every device; the route itself
  // is guarded by RequireRole and RLS.
  for (const role of ['admin', 'moderator', 'authority'] as const) {
    test(`${role} can reach /admin from the map shortcut and from /me`, async ({ page }) => {
      await page.goto('/login')
      await loginAs(page, staffEmail(role))
      await page.goto('/')

      await page.getByRole('link', { name: /^Administration/ }).click()
      await expect(page).toHaveURL(/\/admin$/)
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

      await page.goto('/me')
      await page.getByRole('link', { name: "Accéder à l'administration" }).click()
      await expect(page).toHaveURL(/\/admin$/)
    })
  }

  test('/admin fits the screen on every tab and a klash opens from the listing', async ({
    page,
  }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('admin'))
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

    const hasHorizontalScroll = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      )

    // Each tab is measured once its content is there, not while its spinner
    // (role="status") is: an empty panel can't overflow.
    for (const tab of ['À trier', 'Rôles']) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      await expect(page.getByRole('status')).toHaveCount(0)
      expect(await hasHorizontalScroll()).toBe(false)
    }

    await page.getByRole('button', { name: 'Signalements', exact: true }).click()
    const firstKlash = page.locator('a[href^="/k/"]:visible').first()
    await expect(firstKlash).toBeVisible()
    expect(await hasHorizontalScroll()).toBe(false)

    await firstKlash.click()
    await expect(page).toHaveURL(/\/k\//)
  })

  test('the klash listing sorts server-side, keeps the sort in the URL and resets it', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/login')
    await loginAs(page, staffEmail('admin'))
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible()

    // The counts as displayed, in listing order: table cells from 768px,
    // card text ("Aucune confirmation" / "1 confirmation" / "N confirmations"
    // and the same for comments) below.
    async function counts(kind: 'confirmations' | 'comments'): Promise<number[]> {
      if (isMobile) {
        const cards = await page.getByRole('list', { name: 'Signalements' }).getByRole('listitem')
        const texts = await cards.allInnerTexts()
        const word = kind === 'confirmations' ? /(\d+) confirmation/ : /(\d+) commentaire/
        return texts.map((text) => Number(word.exec(text)?.[1] ?? 0))
      }
      const column = kind === 'confirmations' ? 5 : 6
      const cells = await page.locator(`tbody tr td:nth-child(${column})`).allInnerTexts()
      return cells.map(Number)
    }
    const settled = () => expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    const isSorted = (values: number[], direction: 'asc' | 'desc') =>
      values.every(
        (value, i) =>
          i === 0 || (direction === 'desc' ? values[i - 1] >= value : values[i - 1] <= value),
      )

    // Polled, not read once: the URL changes a render before the new rows
    // arrive, so the order is only expected to settle.
    async function expectSorted(kind: 'confirmations' | 'comments', direction: 'asc' | 'desc') {
      await expect
        .poll(async () => {
          const values = await counts(kind)
          return values.length > 1 && isSorted(values, direction)
        })
        .toBe(true)
    }

    await expect(page).not.toHaveURL(/sort=|dir=/)

    async function sortBy(
      kind: 'confirmations' | 'comments',
      direction: 'asc' | 'desc',
      mobileLabel: string,
    ) {
      if (isMobile) {
        await page.getByLabel('Trier par').selectOption({ label: mobileLabel })
      } else {
        const header = page.getByRole('columnheader', {
          name: kind === 'confirmations' ? 'Confirmations' : 'Commentaires',
        })
        const button = header.getByRole('button')
        const active = (await header.getAttribute('aria-sort')) !== null
        // An inactive column sorts descending first; the active one flips.
        if (direction === 'asc' && !active) await button.click()
        await button.click()
      }
      await expect(page).toHaveURL(
        direction === 'desc'
          ? new RegExp(`sort=${kind}(&|$)`)
          : kind === 'confirmations'
            ? /sort=confirmations&dir=asc/
            : /sort=comments&dir=asc/,
      )
      await settled()
    }

    await sortBy('confirmations', 'desc', 'Plus confirmés')
    if (!isMobile) {
      await expect(page.getByRole('columnheader', { name: 'Confirmations' })).toHaveAttribute(
        'aria-sort',
        'descending',
      )
    }
    await expectSorted('confirmations', 'desc')

    await sortBy('confirmations', 'asc', 'Moins confirmés')
    if (!isMobile) {
      await expect(page.getByRole('columnheader', { name: 'Confirmations' })).toHaveAttribute(
        'aria-sort',
        'ascending',
      )
    }
    await expectSorted('confirmations', 'asc')

    // The sort survives a reload, URL and order both.
    await page.reload()
    await expect(page).toHaveURL(/sort=confirmations&dir=asc/)
    await settled()
    await expectSorted('confirmations', 'asc')
    if (!isMobile) {
      await expect(page.getByRole('columnheader', { name: 'Confirmations' })).toHaveAttribute(
        'aria-sort',
        'ascending',
      )
    } else {
      await expect(page.getByLabel('Trier par')).toHaveValue('confirmations:asc')
    }

    // Keyboard: a header is a button reachable and activable without a mouse.
    if (!isMobile) {
      const commentsButton = page
        .getByRole('columnheader', { name: 'Commentaires' })
        .getByRole('button')
      await commentsButton.focus()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/sort=comments(&|$)/)
      await settled()
      await expect(commentsButton).toBeFocused()
      await expectSorted('comments', 'desc')
    } else {
      await sortBy('comments', 'desc', 'Plus commentés')
      await expectSorted('comments', 'desc')
    }

    // Changing the sort returns to page 1; "Réinitialiser" restores the default.
    await page.getByRole('button', { name: 'Page suivante' }).click()
    await expect(page).toHaveURL(/page=2/)
    await settled()
    await sortBy('confirmations', 'desc', 'Plus confirmés')
    await expect(page).not.toHaveURL(/page=/)

    await page.getByRole('button', { name: 'Réinitialiser' }).click()
    await expect(page).not.toHaveURL(/sort=|dir=|page=/)
  })
})
