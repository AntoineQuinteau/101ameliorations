import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchKlashesNearby } from '../../api/klashes'
import { klashKeys } from '../../api/queryKeys'
import { Badge } from '../../components/Badge'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { statusTone, urgencyTone } from '../../lib/klashPresentation'
import type { Klash } from '../../types/klash'

const DUPLICATE_RADIUS_M = 50

export function DuplicatesStep({
  lat,
  lng,
  onSameProblem,
  onDifferentProblem,
}: {
  lat: number
  lng: number
  onSameProblem: (klash: Klash) => void
  onDifferentProblem: () => void
}) {
  const {
    data: nearby = [],
    isLoading,
    isSuccess,
    isError,
    refetch,
  } = useQuery({
    queryKey: klashKeys.nearby(lat, lng, DUPLICATE_RADIUS_M),
    queryFn: () => fetchKlashesNearby(lat, lng, DUPLICATE_RADIUS_M),
  })

  // Nothing nearby: skip straight to the form instead of showing an empty step.
  useEffect(() => {
    if (isSuccess && nearby.length === 0) onDifferentProblem()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, nearby.length])

  if (isLoading || (isSuccess && nearby.length === 0)) return <Spinner />

  if (isError) {
    return <ErrorMessage message={fr.newKlash.duplicates.loadError} onRetry={() => refetch()} />
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-neutral-900">{fr.newKlash.duplicates.title}</h2>
      <p className="text-sm text-neutral-600">{fr.newKlash.duplicates.body}</p>

      <ul className="flex flex-col gap-2">
        {nearby.map((klash) => (
          <li
            key={klash.id}
            className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3"
          >
            <p className="text-sm font-medium text-neutral-900">{klash.title}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge label={fr.category[klash.category]} tone="gray" />
              <Badge label={fr.urgency[klash.urgency]} tone={urgencyTone(klash.urgency)} />
              <Badge label={fr.status[klash.status]} tone={statusTone(klash.status)} />
            </div>
            <button
              type="button"
              onClick={() => onSameProblem(klash)}
              className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              {fr.newKlash.duplicates.sameProblem}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onDifferentProblem}
        className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      >
        {fr.newKlash.duplicates.differentProblem}
      </button>
    </div>
  )
}
