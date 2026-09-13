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
import { useAuth } from '../auth/useAuth'

const DUPLICATE_RADIUS_M = 50

export function DuplicatesStep({
  lat,
  lng,
  onSameProblem,
  onDifferentProblem,
  onCancel,
}: {
  lat: number
  lng: number
  onSameProblem: (klash: Klash) => void
  onDifferentProblem: () => void
  onCancel: () => void
}) {
  const { user } = useAuth()
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
        {nearby.map((klash) => {
          const isOwn = Boolean(user) && klash.authorId === user?.id
          return (
            <li key={klash.id}>
              {/* The whole card opens the klash's detail (new tab, so the
               * draft in progress here survives) — not a <Link> wrapping a
               * <button>, which nests two interactive elements invalidly.
               * The action button stops propagation so its own click (which
               * takes priority) doesn't also open the detail. */}
              <div
                role="link"
                tabIndex={0}
                onClick={() => window.open(`/k/${klash.id}`, '_blank', 'noopener')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    window.open(`/k/${klash.id}`, '_blank', 'noopener')
                  }
                }}
                className="flex cursor-pointer flex-col gap-2 rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50"
              >
                <p className="text-sm font-medium text-neutral-900">{klash.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge label={fr.category[klash.category]} tone="gray" />
                  <Badge label={fr.urgency[klash.urgency]} tone={urgencyTone(klash.urgency)} />
                  <Badge label={fr.status[klash.status]} tone={statusTone(klash.status)} />
                </div>
                {isOwn ? (
                  // An author can't confirm their own klash (confirmations_insert_self
                  // rejects it server-side) — offer the equivalent of "Annuler" instead
                  // of a button that would fail.
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onCancel()
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
                  >
                    {fr.newKlash.duplicates.alreadyMine}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSameProblem(klash)
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
                  >
                    {fr.newKlash.duplicates.sameProblem}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.newKlash.cancel}
        </button>
        <button
          type="button"
          onClick={onDifferentProblem}
          className="flex-1 inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.newKlash.duplicates.differentProblem}
        </button>
      </div>
    </div>
  )
}
