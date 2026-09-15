import { Link } from 'react-router-dom'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { formatDate } from '../../utils/formatDate'
import { useTriageQueue } from './useAdminKlashes'

function ageInDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000))
}

/** "À trier" queue (spec §6.6): klashs `new` for more than 7 days, with no
 * moderator/authority action yet. Self-contained, like StatusHistory/
 * CommentList: owns its own query and loading/error/empty states. */
export function TriageQueue() {
  const { data: klashes, isLoading, isError, refetch } = useTriageQueue()

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">{fr.admin.triage.body}</p>

      {isLoading && <Spinner />}
      {isError && <ErrorMessage message={fr.admin.triage.loadError} onRetry={() => refetch()} />}

      {klashes && klashes.length === 0 && (
        <p className="text-sm text-neutral-500">{fr.admin.triage.empty}</p>
      )}

      {klashes && klashes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {klashes.map((klash) => (
            <li key={klash.id}>
              <Link
                to={`/k/${klash.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3 hover:bg-neutral-50"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-neutral-900">{klash.title}</span>
                  <span className="text-xs text-neutral-500">{formatDate(klash.createdAt)}</span>
                </div>
                <span className="text-xs text-neutral-500">
                  {fr.admin.triage.ageInDays(ageInDays(klash.createdAt))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
