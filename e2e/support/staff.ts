import { test } from '@playwright/test'

export type StaffRole = 'moderator' | 'authority' | 'admin'

// Number of e2e staff accounts per role in supabase/seed-e2e.sql. Must be at
// least `workers` in playwright.config.ts.
const E2E_STAFF_SLOTS = 4

/**
 * Email of the seeded staff account with `role` reserved for the running
 * Playwright worker (supabase/seed-e2e.sql).
 *
 * Supabase keeps a single OTP per user, so two workers logging in to the same
 * address at once overwrite each other's code. `parallelIndex` is unique among
 * the workers running at any moment (across both projects) and is reused by a
 * worker's replacement, so each address is only ever logged into by one worker
 * at a time.
 */
export function staffEmail(role: StaffRole): string {
  const slot = test.info().parallelIndex
  if (slot >= E2E_STAFF_SLOTS) {
    throw new Error(
      `No e2e staff account for worker slot ${slot}: supabase/seed-e2e.sql seeds ${E2E_STAFF_SLOTS} per role. Seed more slots or lower \`workers\` in playwright.config.ts.`,
    )
  }
  return `e2e-${role}-${slot}@101ameliorations.test`
}
