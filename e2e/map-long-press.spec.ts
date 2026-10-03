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

  // Chrome on Android sends `contextmenu` at the platform long-press timeout
  // (400ms on Android 12+), before ours. Letting it through would open the
  // browser's menu and cancel the touch: it has to be prevented while a press
  // is in progress — and only then, so a desktop right-click keeps its menu.
  test('the native context menu is suppressed during a press, not outside one', async ({
    page,
  }) => {
    const point = await mapPickPoint(page)
    const cdp = await page.context().newCDPSession(page)
    const fireContextMenu = () =>
      page.evaluate(({ x, y }) => {
        const target = document.elementFromPoint(x, y)
        if (!target) throw new Error('nothing under the finger')
        // dispatchEvent returns false when a listener called preventDefault.
        return !target.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          }),
        )
      }, point)

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    expect(await fireContextMenu()).toBe(true)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

    expect(await fireContextMenu()).toBe(false)
  })
})

// Same gesture with a mouse. The mouse path is timed from Leaflet's own
// mousedown/mouseup, separately from the touch path above.
test.describe('map long-press (mouse)', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse gesture, desktop project only')

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await dismissInstallBanner(page)
  })

  const reportButton = (page: Page) => page.getByRole('button', { name: 'Signaler ici' })

  /** Horizontal distance between the pending pin (its icon is centred on the
   * picked point) and `x`. The class tells it apart from klash markers. */
  async function pinOffsetFrom(page: Page, x: number): Promise<number> {
    const box = await page.locator('.leaflet-marker-icon.drop-shadow-md').boundingBox()
    return box ? Math.abs(box.x + box.width / 2 - x) : Number.POSITIVE_INFINITY
  }

  async function holdLeftButton(page: Page, point: Point): Promise<void> {
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.waitForTimeout(LONG_PRESS_WAIT_MS)
    await page.mouse.up()
  }

  test('a short click picks a point', async ({ page }) => {
    const { x, y } = await mapPickPoint(page)

    await page.mouse.click(x, y)

    await expect(reportButton(page)).toBeVisible()
    await expect.poll(() => pinOffsetFrom(page, x)).toBeLessThan(8)
  })

  test('holding the left button picks a point', async ({ page }) => {
    const point = await mapPickPoint(page)

    await holdLeftButton(page, point)

    await expect(reportButton(page)).toBeVisible()
    await expect.poll(() => pinOffsetFrom(page, point.x)).toBeLessThan(8)
  })

  // The click that follows a long-press release is ignored, but a *new* click
  // (it starts with its own mousedown) must not be, however soon it comes.
  test('a click right after a long-press moves the pin', async ({ page }) => {
    const first = await mapPickPoint(page)
    const second = { x: first.x + 120, y: first.y + 60 }

    await holdLeftButton(page, first)
    await page.mouse.click(second.x, second.y)

    await expect.poll(() => pinOffsetFrom(page, second.x)).toBeLessThan(8)
  })

  // The click that follows a long-press release must not pick a second time:
  // a 2px move before release (under Leaflet's 3px drag threshold) would make
  // the pin jump by 2px if it did.
  test('a long-press picks exactly once', async ({ page }) => {
    const point = await mapPickPoint(page)

    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.waitForTimeout(LONG_PRESS_WAIT_MS)
    await page.mouse.move(point.x + 2, point.y)
    await page.mouse.up()

    await expect(reportButton(page)).toBeVisible()
    await expect.poll(() => pinOffsetFrom(page, point.x)).toBeLessThan(1)
  })

  // A long-press released after a drag produces no click at all, so the
  // suppression armed by its release is never consumed: the next click (its
  // own mousedown clears it) must still pick.
  test('a click after a long-press that was dragged is not swallowed', async ({ page }) => {
    const first = await mapPickPoint(page)
    const second = { x: first.x + 160, y: first.y + 80 }

    await page.mouse.move(first.x, first.y)
    await page.mouse.down()
    await page.waitForTimeout(LONG_PRESS_WAIT_MS)
    await page.mouse.move(first.x + 20, first.y, { steps: 4 })
    await page.mouse.up()
    await expect(reportButton(page)).toBeVisible()

    await page.mouse.click(second.x, second.y)

    await expect.poll(() => pinOffsetFrom(page, second.x)).toBeLessThan(8)
  })

  // Shift+drag is Leaflet's box zoom, which never emits `dragstart`: the press
  // timer must not start for it.
  test('shift+drag (box zoom) does not pick a point', async ({ page }) => {
    const { x, y } = await mapPickPoint(page)

    await page.keyboard.down('Shift')
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.waitForTimeout(LONG_PRESS_WAIT_MS)
    await expect(reportButton(page)).toBeHidden()
    await page.mouse.up()
    await page.keyboard.up('Shift')
  })

  test('a desktop right-click keeps the native context menu', async ({ page }) => {
    const { x, y } = await mapPickPoint(page)

    const prevented = await page.evaluate(
      ({ x, y }) => {
        const target = document.elementFromPoint(x, y)
        if (!target) throw new Error('nothing under the pointer')
        return !target.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          }),
        )
      },
      { x, y },
    )

    expect(prevented).toBe(false)
  })

  // A right or middle press opens the native context menu / autoscroll, which
  // takes the mouseup: the timer must never start for them. Checked while the
  // button is still held, since automation can't reproduce the lost mouseup.
  for (const button of ['right', 'middle'] as const) {
    test(`holding the ${button} button does not pick a point`, async ({ page }) => {
      const { x, y } = await mapPickPoint(page)

      await page.mouse.move(x, y)
      await page.mouse.down({ button })
      await page.waitForTimeout(LONG_PRESS_WAIT_MS)
      await expect(reportButton(page)).toBeHidden()
      await page.mouse.up({ button })
    })
  }
})
