import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const LOCK_ROOT = path.join(os.tmpdir(), '101ameliorations-e2e-email-locks')
const POLL_MS = 250
// A lock older than this was left behind by a crashed run, not held by a live
// login (a login, including its wait for the next sender's window, takes well
// under half a minute).
const STALE_AFTER_MS = 90_000
const GIVE_UP_AFTER_MS = 120_000

function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

async function isStale(lockDir: string): Promise<boolean> {
  try {
    const { mtimeMs } = await fs.stat(lockDir)
    return Date.now() - mtimeMs > STALE_AFTER_MS
  } catch {
    return false
  }
}

/**
 * Runs `fn` while holding a lock on `email`, shared by every Playwright worker
 * process on this machine.
 *
 * Why it exists: Supabase keeps a single OTP per user and refuses a second one
 * within `auth.email.max_frequency` (supabase/config.toml). The seeded staff
 * accounts are logged into by specs running in parallel (both projects, several
 * workers), so two logins to the same address would either be refused or, if
 * retried, overwrite each other's code. Queueing them per address avoids both.
 * Different addresses never wait on each other.
 *
 * The lock is a directory: `mkdir` either creates it or fails with `EEXIST`
 * atomically, across processes. Stale locks are cleared after
 * `STALE_AFTER_MS`; the stale check is repeated right before removal so two
 * waiters don't remove a lock the other has just legitimately taken.
 */
export async function withEmailLock<T>(email: string, fn: () => Promise<T>): Promise<T> {
  const key = createHash('sha1').update(email.toLowerCase()).digest('hex')
  const lockDir = path.join(LOCK_ROOT, key)
  await fs.mkdir(LOCK_ROOT, { recursive: true })

  const deadline = Date.now() + GIVE_UP_AFTER_MS
  for (;;) {
    try {
      await fs.mkdir(lockDir)
      break
    } catch (error) {
      if (!isErrno(error, 'EEXIST')) throw error
    }
    if ((await isStale(lockDir)) && (await isStale(lockDir))) {
      await fs.rm(lockDir, { recursive: true, force: true })
      continue
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out after ${GIVE_UP_AFTER_MS}ms waiting for the login lock on ${email}`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }

  try {
    return await fn()
  } finally {
    await fs.rm(lockDir, { recursive: true, force: true })
  }
}
