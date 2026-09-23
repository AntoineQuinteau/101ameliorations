import { fr } from '../../i18n/fr'
import type { KlashCategory, KlashStatus, KlashImportance } from '../../types/klash'
import {
  ALL_CATEGORIES,
  ALL_STATUSES,
  ALL_IMPORTANCES,
  defaultFilters,
  type KlashFilters,
} from './klashFilters'

const PERIOD_PRESETS: { label: string; days: number | null }[] = [
  { label: fr.map.filters.periodAny, days: null },
  { label: fr.map.filters.periodLast7Days, days: 7 },
  { label: fr.map.filters.periodLast30Days, days: 30 },
  { label: fr.map.filters.periodLast90Days, days: 90 },
]

function daysAgoIsoDate(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function toggleButtonClass(active: boolean): string {
  return `rounded-md border px-2 py-2 text-xs font-medium ${
    active
      ? 'border-teal-700 bg-teal-50 text-teal-800'
      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
  }`
}

/** Filters sheet for the map on mobile (spec §6.1): near-full-height so this
 * many controls never need an inner scroll, filtering the map live as each
 * chip is toggled (see MapPage) — "Voir sur la carte" only dismisses the
 * sheet, it does not itself change anything. */
export function MobileFiltersSheet({
  filters,
  resultsCount,
  onChange,
  onClose,
}: {
  filters: KlashFilters
  resultsCount: number
  onChange: (filters: KlashFilters) => void
  onClose: () => void
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[1000] flex h-[92vh] flex-col rounded-t-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">{fr.map.filters.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={fr.map.filters.close}
          className="shrink-0 text-lg leading-none text-neutral-400 hover:text-neutral-600"
        >
          ×
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-sm text-neutral-500">{fr.map.resultsCount(resultsCount)}</p>
        <button
          type="button"
          onClick={() => onChange(defaultFilters)}
          className="shrink-0 text-sm font-medium text-teal-700 hover:underline"
        >
          {fr.map.filters.reset}
        </button>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4">
          <div>
            <span className="text-sm font-medium text-neutral-700">
              {fr.map.filters.categoryLabel}
            </span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {ALL_CATEGORIES.map((option: KlashCategory) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange({ ...filters, categories: toggle(filters.categories, option) })
                  }
                  aria-pressed={filters.categories.includes(option)}
                  className={toggleButtonClass(filters.categories.includes(option))}
                >
                  {fr.category[option]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-neutral-700">
              {fr.map.filters.importanceLabel}
            </span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {ALL_IMPORTANCES.map((option: KlashImportance) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange({ ...filters, importances: toggle(filters.importances, option) })
                  }
                  aria-pressed={filters.importances.includes(option)}
                  className={toggleButtonClass(filters.importances.includes(option))}
                >
                  {fr.importance[option]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-neutral-700">
              {fr.map.filters.statusLabel}
            </span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {ALL_STATUSES.map((option: KlashStatus) => (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange({ ...filters, statuses: toggle(filters.statuses, option) })
                  }
                  aria-pressed={filters.statuses.includes(option)}
                  className={toggleButtonClass(filters.statuses.includes(option))}
                >
                  {fr.status[option]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-neutral-700">
              {fr.map.filters.periodLabel}
            </span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {PERIOD_PRESETS.map((preset) => {
                const value = preset.days === null ? null : daysAgoIsoDate(preset.days)
                const active = filters.createdAfter === value
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange({ ...filters, createdAfter: value })}
                    aria-pressed={active}
                    className={toggleButtonClass(active)}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 shrink-0 inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
      >
        {fr.map.filters.viewOnMap}
      </button>
    </div>
  )
}
