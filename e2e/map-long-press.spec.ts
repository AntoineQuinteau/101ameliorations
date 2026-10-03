import { test, expect, type Page } from '@playwright/test'
import { dismissInstallBanner } from './support/dismissInstallBanner'

// Spec §6.1: on mobile, a long-press on the map drops the "signaler ici" pin.
// Real touch browsers only emit compatibility mouse events *after* touchend,
// so the gesture has to be driven with genuine touch input (CDP
// Input.dispatchTouchEvent) — `page.mouse` would pass even with the bug.

const LONG_PRESS_WAIT_MS = 800

type Point = { x: number; y: number }

/** A point on the bare map, one third down: well clear of the bottom overlays
 * (install banner, footer links, floating controls) that would intercept it. */
async function mapPickPoint(page: Page): Promise<Point> {
  const box = await page.locator('.leaflet-container').first().boundingBox()
  if (!box) throw new Error('map container not found')
  return { x: box.x + box.width / 2, y: box.y + box.height / 3 }
}

/** Real touch input through CDP: put a finger down, hold past the long-press
 * delay, lift it. */
async function longPress(page: Page, point: Point): Promise<void> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await page.waitForTimeout(LONG_PRESS_WAIT_MS)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/**
 * Like `longPress`, but the finger drifts through each `{dx, dy}` offset
 * (relative to `point`) while holding. Dispatches synthetic `TouchEvent`s from
 * the page instead of CDP input: Chromium swallows every touchmove inside its
 * ~15px touch-slop region, so CDP can never deliver the 3–15px drift that
 * WebKit (iOS Safari) hands straight to Leaflet's map drag handler.
 */
async function longPressWithDrift(
  page: Page,
  point: Point,
  drift: { dx: number; dy: number }[],
): Promise<void> {
  await page.evaluate(
    async ({ x, y, drift, holdMs }) => {
      const target = document.elementFromPoint(x, y)
      if (!target) throw new Error('nothing under the finger')
      const fire = (type: string, cx: number, cy: number) => {
        const touch = new Touch({ identifier: 1, target, clientX: cx, clientY: cy })
        const active = type === 'touchend' ? [] : [touch]
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: active,
            targetTouches: active,
            changedTouches: [touch],
          }),
        )
      }
      fire('touchstart', x, y)
      for (const { dx, dy } of drift) fire('touchmove', x + dx, y + dy)
      await new Promise((resolve) => setTimeout(resolve, holdMs))
      const last = drift.at(-1) ?? { dx: 0, dy: 0 }
      fire('touchend', x + last.dx, y + last.dy)
    },
    { x: point.x, y: point.y, drift, holdMs: LONG_PRESS_WAIT_MS },
  )
}

test.describe('map long-press (touch)', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch gesture, mobile project only')

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await dismissInstallBanner(page)
  })

  test('holding a finger on the map picks a point', async ({ page }) => {
    await longPress(page, await mapPickPoint(page))

    await expect(page.getByRole('button', { name: 'Signaler ici' })).toBeVisible()
  })

  test('a short tap still picks a point', async ({ page }) => {
    const { x, y } = await mapPickPoint(page)

    await page.touchscreen.tap(x, y)

    await expect(page.getByRole('button', { name: 'Signaler ici' })).toBeVisible()
  })

  test('the tap right after a long-press is not swallowed', async ({ page }) => {
    const { x, y } = await mapPickPoint(page)
    await longPress(page, { x, y })
    const reportButton = page.getByRole('button', { name: 'Signaler ici' })
    await expect(reportButton).toBeVisible()

    // Dismiss, then tap elsewhere: must open the card again.
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(reportButton).toBeHidden()
    await page.touchscreen.tap(x + 40, y + 40)
    await expect(reportButton).toBeVisible()
  })

  // Leaflet starts dragging the map after ~3px of movement, well inside the
  // 15px a real finger drifts during a hold. Drag start must not cancel the
  // press: only exceeding the tolerance does.
  test('normal finger drift within the tolerance still picks a point', async ({ page }) => {
    await longPressWithDrift(page, await mapPickPoint(page), [
      { dx: 4, dy: 0 },
      { dx: 8, dy: 3 },
    ])

    await expect(page.getByRole('button', { name: 'Signaler ici' })).toBeVisible()
  })

  test('dragging the finger past the tolerance before the delay does not pick a point', async ({
    page,
  }) => {
    await longPressWithDrift(
      page,
      await mapPickPoint(page),
      [10, 20, 30, 40, 50].map((dx) => ({ dx, dy: 0 })),
    )

    await expect(page.getByRole('button', { name: 'Signaler ici' })).toBeHidden()
  })
})
