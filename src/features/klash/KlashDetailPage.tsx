import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { fetchKlashById } from '../../api/klashes'
import { klashKeys } from '../../api/queryKeys'
import { Badge } from '../../components/Badge'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { statusTone, urgencyTone } from '../../lib/klashPresentation'
import { formatDate } from '../../utils/formatDate'
import { useAuth } from '../auth/useAuth'
import { KlashMiniMap } from './KlashMiniMap'
import { useConfirmKlash } from './useConfirmKlash'
import { useMyConfirmation } from './useMyConfirmation'

/** Read-only detail page (spec §6.3), plus the confirm (+1) button added at
 * step 4. Edit/delete and comments still arrive later (step 6/7). */
export function KlashDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const {
    data: klash,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: klashKeys.detail(id ?? ''),
    queryFn: () => fetchKlashById(id as string),
    enabled: Boolean(id),
  })

  const { data: hasConfirmed = false } = useMyConfirmation(id ?? '')
  const confirmMutation = useConfirmKlash(id ?? '', hasConfirmed)
  const isAuthor = Boolean(user) && user?.id === klash?.authorId

  return (
    <div className="mx-auto max-w-xl px-4 py-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
          {fr.common.backToMap}
        </Link>
        <Link
          to={user ? '/me' : '/login'}
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          {user ? fr.auth.mySpace : fr.auth.signIn}
        </Link>
      </div>

      {isLoading && <Spinner />}

      {isError && <ErrorMessage message={fr.detail.loadError} onRetry={() => refetch()} />}

      {!isLoading && !isError && !klash && (
        <div className="mt-6 text-center">
          <h1 className="text-lg font-semibold text-neutral-900">{fr.detail.notFoundTitle}</h1>
          <p className="mt-1 text-sm text-neutral-500">{fr.detail.notFoundBody}</p>
        </div>
      )}

      {klash && (
        <article className="mt-4 flex flex-col gap-4">
          <KlashMiniMap klash={klash} />

          <div className="flex flex-wrap gap-1.5">
            <Badge label={fr.category[klash.category]} tone="gray" />
            <Badge label={fr.urgency[klash.urgency]} tone={urgencyTone(klash.urgency)} />
            <Badge label={fr.status[klash.status]} tone={statusTone(klash.status)} />
          </div>

          <h1 className="text-xl font-semibold text-neutral-900">{klash.title}</h1>

          {klash.description && (
            <p className="text-sm whitespace-pre-wrap text-neutral-700">{klash.description}</p>
          )}

          {klash.status === 'duplicate' && klash.duplicateOf && (
            <p className="text-sm text-neutral-500">
              {fr.detail.duplicateOfNotice}{' '}
              <Link
                to={`/k/${klash.duplicateOf}`}
                className="font-medium text-teal-700 hover:underline"
              >
                {fr.map.viewDetail}
              </Link>
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-neutral-500">{fr.detail.reportedBy}</dt>
              <dd className="font-medium text-neutral-900">
                {klash.authorDisplayName ?? fr.common.anonymousAuthor}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">{fr.detail.confirmations}</dt>
              <dd className="font-medium text-neutral-900">{klash.confirmationsCount}</dd>
            </div>
          </dl>

          <div>
            <button
              type="button"
              disabled={!user || isAuthor || confirmMutation.isPending}
              aria-busy={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}
              className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {hasConfirmed ? fr.detail.confirmed : fr.detail.confirm}
            </button>
            {confirmMutation.isError && <ErrorMessage message={fr.detail.confirmError} />}
          </div>

          <p className="text-xs text-neutral-500">
            {klash.status === 'resolved' && klash.resolvedAt
              ? fr.detail.resolvedOn(formatDate(klash.resolvedAt))
              : fr.detail.updatedOn(formatDate(klash.updatedAt))}
          </p>
        </article>
      )}
    </div>
  )
}
