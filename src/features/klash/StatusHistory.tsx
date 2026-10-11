import { useId, type ReactNode } from 'react'
import { Badge } from '../../components/Badge'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { displayActor, statusTone } from '../../lib/klashPresentation'
import type { Klash, KlashStatus } from '../../types/klash'
import { formatDate } from '../../utils/formatDate'
import { useStatusHistory } from './useStatusHistory'

/** "Historique des statuts" section for `/k/:id` (spec §6.3), as a vertical
 * timeline rather than cards, so it cannot be mistaken for the comments
 * below/beside it: one step per status the klash entered — its creation
 * first, then every change — each with who did it, when, and their note if
 * they left one. The status a change came *from* is the previous step's.
 * Self-contained, like CommentList: owns its own query and renders its own
 * loading/error states. The creation step comes from the klash itself, so
 * it shows straight away and the section is never empty. */
export function StatusHistory({ klash }: { klash: Klash }) {
  const titleId = useId()
  const { data: history, isLoading, isError, refetch } = useStatusHistory(klash.id)

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-sm font-semibold text-neutral-900">
        {fr.detail.lifecycle.historyTitle}
      </h2>

      <ol className="flex flex-col">
        <TimelineStep
          status="new"
          date={klash.createdAt}
          actor={displayActor(klash.authorRole, klash.authorDisplayName, klash.authorOrganization)}
        >
          <p className="text-sm text-neutral-700">{fr.detail.lifecycle.createdStep}</p>
        </TimelineStep>

        {history?.map((change) => (
          <TimelineStep
            key={change.id}
            status={change.toStatus}
            date={change.createdAt}
            actor={displayActor(
              change.changedByRole,
              change.changedByDisplayName,
              change.changedByOrganization,
            )}
          >
            {change.note && (
              <p className="text-sm whitespace-pre-wrap text-neutral-700">{change.note}</p>
            )}
          </TimelineStep>
        ))}
      </ol>

      {isLoading && <Spinner />}
      {isError && (
        <ErrorMessage message={fr.detail.lifecycle.historyLoadError} onRetry={() => refetch()} />
      )}
    </section>
  )
}

function TimelineStep({
  status,
  date,
  actor,
  children,
}: {
  status: KlashStatus
  date: string
  actor: string
  children?: ReactNode
}) {
  return (
    <li className="group relative flex flex-col gap-1 pb-5 pl-6 last:pb-0">
      {/* The line runs from this step's dot down to the next step's. */}
      <span
        aria-hidden="true"
        className="absolute top-3 -bottom-2 left-[4px] w-0.5 bg-neutral-400 group-last:hidden"
      />
      <span
        aria-hidden="true"
        className="absolute top-1.5 left-0 size-2.5 rounded-full border-2 border-teal-700 bg-white"
      />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge label={fr.status[status]} tone={statusTone(status)} />
        <span className="text-xs text-neutral-500">{formatDate(date)}</span>
      </div>
      <p className="text-xs text-neutral-500">{actor}</p>
      {children}
    </li>
  )
}
