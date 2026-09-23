import type { UserRole } from '../types/profile'
import type { KlashStatus } from '../types/klash'

// Pure mirror of the klashes table's UPDATE/DELETE RLS policies
// (klashes_update_author_new + klashes_update_staff, klashes_delete_
// author_or_staff — supabase/migrations/20260907225955_initial_schema.sql,
// 20260915075244_klash_lifecycle.sql) and the spec §2/§6.3 permissions
// table. Kept as a plain module (no React) so it's unit-testable the way
// the rest of this repo tests logic (see src/lib/klashTransitions.ts), and
// so the UI never offers an edit or delete the database would refuse. The
// database is still the authority: this only decides what to *show*.

/** Whether `role` may edit a klash's category/urgency/title/description/
 * proposed solution and manage its photos (spec §6.3: "Modifier ...
 * (auteur si `new`, moderator, admin)"). An `authority` who is also the
 * klash's author gets edit rights through `isAuthor` like any other role —
 * `guard_klash_authority_columns()` carries the same `author_id = auth.uid()`
 * exemption for editing one's own klash — but never for someone else's:
 * an authority may only change status there. */
export function canEditKlash(
  role: UserRole | null,
  isAuthor: boolean,
  status: KlashStatus,
): boolean {
  return (isAuthor && status === 'new') || role === 'moderator' || role === 'admin'
}

/** Whether `role` may delete a klash outright (spec §2: "Modifier /
 * supprimer son klash" for its author while `new`; "... n'importe quel
 * klash" for moderator/admin at any status). Mirrors the expression
 * previously inlined in KlashDetailPage — unchanged, just named and
 * testable. Deliberately stricter than klashes_delete_author_or_staff
 * (which has no status condition for the author): this is a UI choice, not
 * a database limit. */
export function canDeleteKlash(
  role: UserRole | null,
  isAuthor: boolean,
  status: KlashStatus,
): boolean {
  return isAuthor && status === 'new' ? true : role === 'moderator' || role === 'admin'
}
