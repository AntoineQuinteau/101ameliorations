import type { KlashStatus, KlashUrgency } from '../types/klash'

export type BadgeTone = 'green' | 'amber' | 'red' | 'gray' | 'blue' | 'indigo'

/** Visual tone for an urgency badge (low → green, medium → amber, high → red). */
export function urgencyTone(urgency: KlashUrgency): BadgeTone {
  const tones: Record<KlashUrgency, BadgeTone> = { low: 'green', medium: 'amber', high: 'red' }
  return tones[urgency]
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
