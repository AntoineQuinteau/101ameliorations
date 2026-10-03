import { test, expect, type Page } from '@playwright/test'
import { dismissInstallBanner } from './support/dismissInstallBanner'

// Spec §6.1: on mobile, a long-press on the map drops the "signaler ici" pin.
// Real touch browsers only emit compatibility mouse events *after* touchend,
// so the gesture has to be driven with genuine touch input (CDP
// Input.dispatchTouchEvent) — `page.mouse` would pass even with the bug.

const LONG_PRESS_WAIT_MS = 800

async function mapCenter(page: Page) {
  const box = await page.locator('.leaflet-container').first().boundingBox()
  if (!box) throw new Error('map container not found')
  return { x: box.x + box.width / 2, y: box.y + box.height / 3 }
}

test.describe('map long-press (touch)', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch gesture, mobile project only')

  test('holding a finger on the map picks a point', async ({ page }) => {
    await page.goto('/')
    await dismissInstallBanner(page)
    const { x, y } = await mapCenter(page)

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    })
    await page.waitForTimeout(LONG_PRESS_WAIT_MS)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    await expect(page.getByRole('button', { name: 'Signaler ici' })).toBeVisible()
  })

  test('a short tap still picks a point', async ({ page }) => {
    await page.goto('/')
    await dismissInstallBanner(page)
    const { x, y } = await mapCenter(page)

    await page.touchscreen.tap(x, y)

    await expect(page.getByRole('button', { name: 'Signaler ici' })).toBeVisible()
  })

  test('the tap right after a long-press is not swallowed', async ({ page }) => {
    await page.goto('/')
    await dismissInstallBanner(page)
    const { x, y } = await mapCenter(page)

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    })
    await page.waitForTimeout(LONG_PRESS_WAIT_MS)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    const reportButton = page.getByRole('button', { name: 'Signaler ici' })
    await expect(reportButton).toBeVisible()

    // Dismiss, then tap elsewhere: must open the card again.
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(reportButton).toBeHidden()
    await page.touchscreen.tap(x + 40, y + 40)
    await expect(reportButton).toBeVisible()
  })

  test('dragging the finger past the tolerance before the delay does not pick a point', async ({
    page,
  }) => {
    await page.goto('/')
    await dismissInstallBanner(page)
    const { x, y } = await mapCenter(page)

    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    })
    await page.waitForTimeout(100)
    for (let step = 1; step <= 5; step++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + step * 10, y }],
      })
    }
    await page.waitForTimeout(LONG_PRESS_WAIT_MS)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    await expect(page.getByRole('button', { name: 'Signaler ici' })).toBeHidden()
  })
})
