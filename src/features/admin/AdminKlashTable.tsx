import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  adminParamsFromSearchParams,
  adminParamsToSearchParams,
  defaultAdminTableParams,
  sinceForPeriod,
  type AdminTableParams,
  type Period,
} from './adminFilterParams'
import { ADMIN_PAGE_SIZE, type AdminKlashFilters } from '../../api/admin'
import { Badge } from '../../components/Badge'
import { ErrorMessage } from '../../components/ErrorMessage'
import { Spinner } from '../../components/Spinner'
import { fr } from '../../i18n/fr'
import { statusTone } from '../../lib/klashPresentation'
import type { KlashCategory, KlashStatus } from '../../types/klash'
import { klashCategoryLabel, klashCategorySchema, klashStatusSchema } from '../../types/klash'
import { formatDate } from '../../utils/formatDate'
import { useAdminKlashes } from './useAdminKlashes'

/** Paginated, filtered, searchable klash table (spec §6.6). The one table
 * component in the app — /me's MyKlashList is a card list, not a table,
 * because it never needed pagination or filters; this does.
 *
 * Filters, period, search and page are all reflected in the URL (spec
 * §6.1's "filtres reflétés dans l'URL, partageables" extended here to
 * /admin), the same way the map does it in `filterParams.ts` — see
 * `adminFilterParams.ts` for the parse/serialise pair and why `since`
 * itself is never one of the written params. */
export function AdminKlashTable() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [params, setParams] = useState<AdminTableParams>(() =>
    adminParamsFromSearchParams(searchParams),
  )

  // Recomputed only when `period` changes, not on every render: it reads
  // Date.now(), so inlining the call directly would change the admin
  // query's cache key on every render and loop the fetch forever (see the
  // docblock on sinceForPeriod).
  const since = useMemo(() => sinceForPeriod(params.period), [params.period])
  const filters: AdminKlashFilters = useMemo(
    () => ({
      status: params.status,
      category: params.category,
      since,
      searchText: params.searchText,
    }),
    [params.status, params.category, since, params.searchText],
  )

  const { data, isLoading, isError, refetch } = useAdminKlashes(filters, params.page)
  const pageCount = data ? Math.max(1, Math.ceil(data.totalCount / ADMIN_PAGE_SIZE)) : 1

  // Single write path for both state and URL, so the two can never drift
  // apart. `replace: true` avoids stacking a browser history entry per
  // keystroke or select change — only /admin's own navigations elsewhere
  // should be back-button stops (same rule as the map's `updateFilters`).
  function updateParams(next: Partial<AdminTableParams>, options?: { resetPage?: boolean }) {
    setParams((current) => {
      const merged: AdminTableParams = {
        ...current,
        ...next,
        page: options?.resetPage === false ? (next.page ?? current.page) : 0,
      }
      setSearchParams(
        (currentSearchParams) => adminParamsToSearchParams(currentSearchParams, merged),
        {
          replace: true,
        },
      )
      return merged
    })
  }

  function handlePeriodChange(next: Period) {
    updateParams({ period: next })
  }

  function handleReset() {
    updateParams(defaultAdminTableParams)
  }

  function goToPage(page: number) {
    updateParams({ page }, { resetPage: false })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 p-3">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.admin.table.searchLabel}
          <input
            type="text"
            value={params.searchText}
            onChange={(event) => updateParams({ searchText: event.target.value })}
            placeholder={fr.admin.table.searchPlaceholder}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.admin.table.statusLabel}
          <select
            value={params.status ?? ''}
            onChange={(event) =>
              updateParams({
                status: event.target.value ? (event.target.value as KlashStatus) : null,
              })
            }
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
          >
            <option value="">{fr.admin.table.periodAny}</option>
            {klashStatusSchema.options.map((status) => (
              <option key={status} value={status}>
                {fr.status[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.admin.table.categoryLabel}
          <select
            value={params.category ?? ''}
            onChange={(event) =>
              updateParams({
                category: event.target.value ? (event.target.value as KlashCategory) : null,
              })
            }
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
          >
            <option value="">{fr.admin.table.periodAny}</option>
            {klashCategorySchema.options.map((category) => (
              <option key={category} value={category}>
                {fr.category[category]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.admin.table.periodLabel}
          <select
            value={params.period}
            onChange={(event) => handlePeriodChange(event.target.value as Period)}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
          >
            <option value="any">{fr.admin.table.periodAny}</option>
            <option value="7">{fr.admin.table.periodLast7Days}</option>
            <option value="30">{fr.admin.table.periodLast30Days}</option>
            <option value="90">{fr.admin.table.periodLast90Days}</option>
          </select>
        </label>

        <button
          type="button"
          onClick={handleReset}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.admin.table.resetFilters}
        </button>
      </div>

      {isLoading && <Spinner />}
      {isError && <ErrorMessage message={fr.admin.table.loadError} onRetry={() => refetch()} />}

      {data && data.klashes.length === 0 && (
        <p className="text-sm text-neutral-500">{fr.admin.table.empty}</p>
      )}

      {data && data.klashes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                <th className="py-2 pr-3 font-medium">{fr.admin.table.columnTitle}</th>
                <th className="py-2 pr-3 font-medium">{fr.admin.table.columnStatus}</th>
                <th className="py-2 pr-3 font-medium">{fr.admin.table.columnCategory}</th>
                <th className="py-2 pr-3 font-medium">{fr.admin.table.columnCreatedAt}</th>
                <th className="py-2 pr-3 font-medium">{fr.admin.table.columnConfirmations}</th>
                <th className="py-2 pr-3 font-medium">{fr.admin.table.columnComments}</th>
              </tr>
            </thead>
            <tbody>
              {data.klashes.map((klash) => (
                <tr key={klash.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/k/${klash.id}`}
                        className="font-medium text-teal-700 hover:underline"
                      >
                        {klash.title}
                      </Link>
                      {klash.proposedSolution && (
                        <Badge label={fr.admin.table.hasProposedSolution} tone="indigo" />
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge label={fr.status[klash.status]} tone={statusTone(klash.status)} />
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">{klashCategoryLabel(klash)}</td>
                  <td className="py-2 pr-3 text-neutral-500">{formatDate(klash.createdAt)}</td>
                  <td className="py-2 pr-3 text-neutral-700">{klash.confirmationsCount}</td>
                  <td className="py-2 pr-3 text-neutral-700">{klash.commentsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.klashes.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={params.page === 0}
            onClick={() => goToPage(params.page - 1)}
            className="rounded-md border border-neutral-300 px-3 py-2 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {fr.admin.table.previousPage}
          </button>
          <span className="text-neutral-500">
            {fr.admin.table.pageIndicator(params.page + 1, pageCount)}
          </span>
          <button
            type="button"
            disabled={params.page + 1 >= pageCount}
            onClick={() => goToPage(params.page + 1)}
            className="rounded-md border border-neutral-300 px-3 py-2 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {fr.admin.table.nextPage}
          </button>
        </div>
      )}
    </div>
  )
}
