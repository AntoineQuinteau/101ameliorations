import { Badge } from '../../components/Badge'
import { fr } from '../../i18n/fr'
import { statusTone } from '../../lib/klashPresentation'
import { klashCategoryLabel, type Klash } from '../../types/klash'
import { formatDate } from '../../utils/formatDate'
import { AdminKlashCardLink } from './AdminKlashCardLink'

/** The admin klash listing below the `md` breakpoint, where the six-column
 * table would need a horizontal scroll: one tappable card per klash, like
 * `TriageQueue` and `MyKlashList`. Same data as the table; `AdminKlashTable`
 * renders both and CSS picks one. */
export function AdminKlashCardList({ klashes }: { klashes: Klash[] }) {
  return (
    <ul aria-label={fr.admin.tabs.klashes} className="flex flex-col gap-2 md:hidden">
      {klashes.map((klash) => (
        <li key={klash.id}>
          <AdminKlashCardLink klashId={klash.id} className="flex-col gap-2">
            <span className="text-sm font-medium break-words text-neutral-900">{klash.title}</span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge label={fr.status[klash.status]} tone={statusTone(klash.status)} />
              {klash.proposedSolution && (
                <Badge label={fr.admin.table.hasProposedSolution} tone="indigo" />
              )}
            </span>
            <span className="text-xs text-neutral-500">
              {klashCategoryLabel(klash)} · {formatDate(klash.createdAt)}
            </span>
            <span className="text-xs text-neutral-500">
              {fr.map.confirmationsCount(klash.confirmationsCount)} ·{' '}
              {fr.admin.table.commentsCount(klash.commentsCount)}
            </span>
          </AdminKlashCardLink>
        </li>
      ))}
    </ul>
  )
}
