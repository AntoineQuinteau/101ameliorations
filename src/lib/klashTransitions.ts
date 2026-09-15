import type { UserRole } from '../types/profile'
import type { KlashStatus } from '../types/klash'

// Pure mirror of `can_change_klash_status()` (supabase/migrations/
// 20260915075244_klash_lifecycle.sql) — the spec §3 graph. Kept as a plain
// module (no React) so it's unit-testable the way the rest of this repo
// tests logic (see src/features/newKlash/submitGuard.ts), and so the UI
// never offers a transition the database would refuse. The database is
// still the authority: this only decides what to *show*, not what's
// allowed — every transition the UI triggers goes through the
// change_klash_status RPC, which re-checks everything server-side.
const MODERATOR_ARROWS: ReadonlyArray<readonly [KlashStatus, KlashStatus]> = [
  ['new', 'rejected'],
  ['new', 'duplicate'],
  ['rejected', 'new'],
  ['duplicate', 'new'],
]

const AUTHORITY_ARROWS: ReadonlyArray<readonly [KlashStatus, KlashStatus]> = [
  ['new', 'acknowledged'],
  ['acknowledged', 'in_progress'],
  ['in_progress', 'resolved'],
  ['resolved', 'in_progress'],
]

/** Every status `role` may move a klash to, starting from `fromStatus`.
 * Empty for `user` and for any role with no arrow out of `fromStatus`. */
export function allowedNextStatuses(role: UserRole, fromStatus: KlashStatus): KlashStatus[] {
  const arrows: Array<readonly [KlashStatus, KlashStatus]> = []
  if (role === 'moderator' || role === 'admin') arrows.push(...MODERATOR_ARROWS)
  if (role === 'authority' || role === 'admin') arrows.push(...AUTHORITY_ARROWS)
  return arrows.filter(([from]) => from === fromStatus).map(([, to]) => to)
}

/** Whether `role` may move a klash from `fromStatus` to `toStatus`. */
export function canChangeKlashStatus(
  role: UserRole,
  fromStatus: KlashStatus,
  toStatus: KlashStatus,
): boolean {
  return allowedNextStatuses(role, fromStatus).includes(toStatus)
}
