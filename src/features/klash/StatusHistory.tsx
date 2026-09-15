import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { displayActor } from '../../lib/klashPresentation'
import { formatDate } from '../../utils/formatDate'
import { useStatusHistory } from './useStatusHistory'

/** "Historique des statuts" section for `/k/:id` (spec §6.3): who changed
 * the status, when, and their optional note. Self-contained, like
 * CommentList: owns its own query and renders its own loading/error/empty
 * states. */
export function StatusHistory({ klashId }: { klashId: string }) {
  const { data: history, isLoading, isError, refetch } = useStatusHistory(klashId)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-neutral-900">{fr.detail.lifecycle.historyTitle}</h2>

      {isLoading && <Spinner />}
      {isError && (
        <ErrorMessage message={fr.detail.lifecycle.historyLoadError} onRetry={() => refetch()} />
      )}

      {history && history.length === 0 && (
        <p className="text-sm text-neutral-500">{fr.detail.lifecycle.historyEmpty}</p>
      )}

      {history && history.length > 0 && (
        <ul className="flex flex-col gap-3">
          {history.map((change) => (
            <li
              key={change.id}
              className="flex flex-col gap-1 rounded-md border border-neutral-200 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-neutral-900">
                  {fr.detail.lifecycle.transitionLine(
                    fr.status[change.fromStatus],
                    fr.status[change.toStatus],
                  )}
                </span>
                <span className="text-xs text-neutral-500">{formatDate(change.createdAt)}</span>
              </div>
              <p className="text-xs text-neutral-500">
                {displayActor(
                  change.changedByRole,
                  change.changedByDisplayName,
                  change.changedByOrganization,
                )}
              </p>
              <p className="text-sm whitespace-pre-wrap text-neutral-700">
                {change.note ?? fr.detail.lifecycle.noNote}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
