import { useState } from 'react'
import { Link } from 'react-router-dom'
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

type Period = 'any' | '7' | '30' | '90'

function sinceForPeriod(period: Period): string | null {
  if (period === 'any') return null
  const days = Number(period)
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

const DEFAULT_FILTERS: AdminKlashFilters = {
  status: null,
  category: null,
  since: null,
  searchText: '',
}

/** Paginated, filtered, searchable klash table (spec §6.6). The one table
 * component in the app — /me's MyKlashList is a card list, not a table,
 * because it never needed pagination or filters; this does. */
export function AdminKlashTable() {
  const [filters, setFilters] = useState<AdminKlashFilters>(DEFAULT_FILTERS)
  const [period, setPeriod] = useState<Period>('any')
  const [page, setPage] = useState(0)

  const { data, isLoading, isError, refetch } = useAdminKlashes(filters, page)
  const pageCount = data ? Math.max(1, Math.ceil(data.totalCount / ADMIN_PAGE_SIZE)) : 1

  function updateFilters(next: Partial<AdminKlashFilters>) {
    setFilters((current) => ({ ...current, ...next }))
    setPage(0)
  }

  function handlePeriodChange(next: Period) {
    setPeriod(next)
    updateFilters({ since: sinceForPeriod(next) })
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS)
    setPeriod('any')
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 p-3">
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.admin.table.searchLabel}
          <input
            type="text"
            value={filters.searchText}
            onChange={(event) => updateFilters({ searchText: event.target.value })}
            placeholder={fr.admin.table.searchPlaceholder}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {fr.admin.table.statusLabel}
          <select
            value={filters.status ?? ''}
            onChange={(event) =>
              updateFilters({
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
            value={filters.category ?? ''}
            onChange={(event) =>
              updateFilters({
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
            value={period}
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
            disabled={page === 0}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-md border border-neutral-300 px-3 py-2 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {fr.admin.table.previousPage}
          </button>
          <span className="text-neutral-500">
            {fr.admin.table.pageIndicator(page + 1, pageCount)}
          </span>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-md border border-neutral-300 px-3 py-2 font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
          >
            {fr.admin.table.nextPage}
          </button>
        </div>
      )}
    </div>
  )
}
