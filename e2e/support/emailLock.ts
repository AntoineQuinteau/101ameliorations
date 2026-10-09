import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const LOCK_ROOT = path.join(os.tmpdir(), '101ameliorations-e2e-email-locks')
const POLL_MS = 250
// Both bounds sit around Playwright's default 30s test timeout (this repo
// sets none): a waiter gives up *before* its own test would time out, so a
// stuck queue fails with this file's message instead of an opaque timeout.
const GIVE_UP_AFTER_MS = 20_000
// A lock older than a test can live is dead whatever its owner says (a reused
// PID, or no owner file because the holder died between `mkdir` and writing
// it). A worker that outlives its test timeout is restarted, so no live
// holder gets near this.
const DEAD_AFTER_MS = 35_000
// How long the cleanup mutex below may exist before it is assumed abandoned.
const CLEANUP_STALE_AFTER_MS = 10_000

function isErrno(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: it exists but belongs to someone else, so it is alive.
    return !isErrno(error, 'ESRCH')
  }
}

async function readOwner(lockDir: string): Promise<number | null> {
  try {
    const pid = Number.parseInt(await fs.readFile(path.join(lockDir, 'owner'), 'utf8'), 10)
    return Number.isInteger(pid) ? pid : null
  } catch {
    return null
  }
}

async function ageMs(target: string): Promise<number | null> {
  try {
    return Date.now() - (await fs.stat(target)).mtimeMs
  } catch {
    return null
  }
}

/** The holder is gone: its process no longer exists (a Playwright worker is
 * restarted after a test timeout, so its `finally` never ran), or the lock is
 * older than any test can run. */
async function isDeadLock(lockDir: string): Promise<boolean> {
  const age = await ageMs(lockDir)
  if (age === null) return false // released in the meantime
  if (age > DEAD_AFTER_MS) return true
  const owner = await readOwner(lockDir)
  return owner !== null && !isProcessAlive(owner)
}

/**
 * Removes a dead lock, at most one waiter at a time. Two waiters can both see
 * the same dead lock; if each simply removed it, the second could delete the
 * fresh lock the first had already re-created and let two logins run together.
 * Taking a short-lived `.cleanup` mutex (atomic `mkdir`) first, and checking
 * again that the lock is still dead once holding it, means only one waiter
 * removes and the others loop back to try `mkdir`. Returns whether this call
 * removed the lock.
 */
async function clearDeadLock(lockDir: string): Promise<boolean> {
  const mutex = `${lockDir}.cleanup`
  try {
    await fs.mkdir(mutex)
  } catch (error) {
    if (!isErrno(error, 'EEXIST')) throw error
    // Held for microseconds by whoever is cleaning; only a crash in that
    // window leaves it behind.
    const mutexAge = await ageMs(mutex)
    if (mutexAge !== null && mutexAge > CLEANUP_STALE_AFTER_MS) {
      await fs.rm(mutex, { recursive: true, force: true })
    }
    return false
  }
  try {
    if (!(await isDeadLock(lockDir))) return false
    await fs.rm(lockDir, { recursive: true, force: true })
    return true
  } finally {
    await fs.rm(mutex, { recursive: true, force: true })
  }
}

/**
 * Runs `fn` while holding a lock on `email`, shared by every Playwright worker
 * process on this machine.
 *
 * Why it exists: Supabase keeps a single OTP per user, so two logins to the
 * same address at once would overwrite each other's code (and, with a short
 * window between sends, be refused: `auth.email.max_frequency` in
 * supabase/config.toml). The seeded staff accounts are logged into by specs
 * running in parallel (both projects, several workers), so same-address
 * logins are queued here. Different addresses never wait on each other.
 *
 * The lock is a directory: `mkdir` either creates it or fails with `EEXIST`
 * atomically, across processes. It holds the owner's PID, so a lock whose
 * holder died is taken over at once rather than after a timeout.
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
    if ((await isDeadLock(lockDir)) && (await clearDeadLock(lockDir))) continue
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out after ${GIVE_UP_AFTER_MS}ms waiting for the login lock on ${email} (${lockDir})`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }

  try {
    await fs.writeFile(path.join(lockDir, 'owner'), String(process.pid))
  } catch (error) {
    await fs.rm(lockDir, { recursive: true, force: true })
    throw error
  }

  try {
    return await fn()
  } finally {
    // Only remove our own lock: if it was judged dead and taken over, the
    // directory now belongs to someone else.
    if ((await readOwner(lockDir)) === process.pid) {
      await fs.rm(lockDir, { recursive: true, force: true })
    }
  }
}
