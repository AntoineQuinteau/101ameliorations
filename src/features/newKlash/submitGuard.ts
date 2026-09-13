/** One-shot guard for the klash creation submit (spec §6.2 step 4).
 *
 * Creating a klash has no natural key the way `confirmations` does (its
 * (klash_id, user_id) primary key makes a double confirm a no-op), so nothing
 * downstream turns a repeated submit into a single row: `create_klash`
 * inserts unconditionally. Three separate paths were each able to fire one
 * user action twice —
 *
 * 1. Two callers for one action: NewKlashPage.startAction() called the submit
 *    directly when already signed in, *and* mounting SubmitStep ran an effect
 *    that called it again via onReady().
 * 2. StrictMode double-invokes that effect, and a `useState` flag set inside
 *    it still reads stale on the second pass — the re-render hasn't committed.
 * 3. A double-tap on the submit button, which was never disabled.
 *
 * (1) and (3) are fixed at their call sites. What (2) shows is that the guard
 * itself must be *synchronous*: any flag that only takes effect on the next
 * render loses the race. Hence a tiny mutable cell rather than component
 * state — `claim()` flips it and reports the outcome in the same tick, so the
 * second caller is turned away before it can reach the network.
 *
 * Kept as a plain module (no React) so it is unit-testable the way the rest
 * of this repo tests logic, without pulling in a component-render harness.
 */
export interface SubmitGuard {
  /** Takes the single slot. `true` for the first caller, `false` for every
   * caller after it — so `if (!guard.claim()) return` is the whole usage. */
  claim: () => boolean
  /** Whether the slot is currently taken. */
  readonly isClaimed: boolean
  /** Frees the slot so a later attempt can run — call after a *failed*
   * submit, so the user can retry. Never call it after a successful one:
   * that is what would let the duplicate through. */
  release: () => void
}

export function createSubmitGuard(): SubmitGuard {
  let claimed = false
  return {
    claim() {
      if (claimed) return false
      claimed = true
      return true
    },
    get isClaimed() {
      return claimed
    },
    release() {
      claimed = false
    },
  }
}
