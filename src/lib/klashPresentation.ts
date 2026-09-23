import type { KlashStatus, KlashImportance } from '../types/klash'
import type { UserRole } from '../types/profile'
import { fr } from '../i18n/fr'

export type BadgeTone = 'green' | 'amber' | 'red' | 'gray' | 'blue' | 'indigo'

/** Visual tone for an importance badge (low → green, medium → amber, high → red). */
export function importanceTone(importance: KlashImportance): BadgeTone {
  const tones: Record<KlashImportance, BadgeTone> = { low: 'green', medium: 'amber', high: 'red' }
  return tones[importance]
}

/** Visual tone for a status badge. Resolved/rejected/duplicate are muted (gray): they are
 * no longer actionable, unlike the active in-progress states. */
export function statusTone(status: KlashStatus): BadgeTone {
  const tones: Record<KlashStatus, BadgeTone> = {
    new: 'blue',
    acknowledged: 'indigo',
    in_progress: 'amber',
    resolved: 'gray',
    rejected: 'gray',
    duplicate: 'gray',
  }
  return tones[status]
}

/** Visual tone for a role badge, staff roles set apart from a plain user. */
export function roleTone(role: UserRole): BadgeTone {
  const tones: Record<UserRole, BadgeTone> = {
    user: 'gray',
    moderator: 'indigo',
    authority: 'blue',
    admin: 'red',
  }
  return tones[role]
}

/** How to name the person or organization behind an action (spec §2: an
 * `authority` account displays its `organization` — e.g. "CAPB" — rather
 * than a pseudo; everyone else shows their pseudo, or the anonymous
 * fallback if they have none). Shared by the klash author line on `/k/:id`
 * and the status-history entries, so both name people the same way. */
export function displayActor(
  role: UserRole,
  displayName: string | null,
  organization: string | null,
): string {
  if (role === 'authority' && organization) return organization
  return displayName ?? fr.common.anonymousAuthor
}
