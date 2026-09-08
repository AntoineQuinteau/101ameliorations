import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchKlashesByAuthor } from '../../api/myKlashes'
import { klashKeys } from '../../api/queryKeys'
import { Badge } from '../../components/Badge'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { statusTone } from '../../lib/klashPresentation'
import { formatDate } from '../../utils/formatDate'

export function MyKlashList({ userId }: { userId: string }) {
  const {
    data: klashes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: klashKeys.byAuthor(userId),
    queryFn: () => fetchKlashesByAuthor(userId),
  })

  if (isLoading) return <Spinner />
  if (isError) return <ErrorMessage message={fr.me.loadError} onRetry={() => refetch()} />

  if (!klashes || klashes.length === 0) {
    return (
      <div className="mt-2 flex flex-col items-center gap-2 rounded-xl bg-white p-6 text-center shadow-lg ring-1 ring-black/5">
        <p className="text-sm text-neutral-500">{fr.me.myKlashesEmpty}</p>
        <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
          {fr.me.myKlashesEmptyCta}
        </Link>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {klashes.map((klash) => (
        <li key={klash.id}>
          <Link
            to={`/k/${klash.id}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/5 hover:bg-neutral-50"
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-900">{klash.title}</span>
              <span className="text-xs text-neutral-500">{formatDate(klash.createdAt)}</span>
            </div>
            <Badge label={fr.status[klash.status]} tone={statusTone(klash.status)} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
