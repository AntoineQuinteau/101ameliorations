import { test, expect } from '@playwright/test'

// Throwaway: only exists to prove the configured browser executable
// actually launches before building the real specs. Safe to keep — cheap
// and catches a broken browser/config combo immediately.
test('map page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/101am/i)
})
