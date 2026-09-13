import { BottomSheet } from '../../components/BottomSheet'
import { fr } from '../../i18n/fr'
import type { KlashCategory, KlashStatus, KlashUrgency } from '../../types/klash'
import {
  ALL_CATEGORIES,
  ALL_STATUSES,
  ALL_URGENCIES,
  defaultFilters,
  type KlashFilters,
  type KlashSort,
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

/** Filters + sort panel for the map (spec §6.1): a bottom sheet on mobile,
 * same shell as the other map overlays (extracted as `BottomSheet`). The
 * "period" filter is a handful of presets rather than a date picker — the
 * granularity the spec asks for, and simpler to use on a phone. */
export function FiltersPanel({
  filters,
  sort,
  resultsCount,
  onChange,
  onSortChange,
  onClose,
}: {
  filters: KlashFilters
  sort: KlashSort
  resultsCount: number
  onChange: (filters: KlashFilters) => void
  onSortChange: (sort: KlashSort) => void
  onClose: () => void
}) {
  function toggleButtonClass(active: boolean): string {
    return `rounded-md border px-2 py-2 text-xs font-medium ${
      active
        ? 'border-teal-700 bg-teal-50 text-teal-800'
        : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
    }`
  }

  return (
    <BottomSheet scrollable>
      <div className="flex flex-col gap-4">
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

        <p className="text-sm text-neutral-500">{fr.map.resultsCount(resultsCount)}</p>

        <div>
          <span className="text-sm font-medium text-neutral-700">
            {fr.map.filters.categoryLabel}
          </span>
          <div className="mt-1 grid grid-cols-5 gap-2">
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
            {fr.map.filters.urgencyLabel}
          </span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {ALL_URGENCIES.map((option: KlashUrgency) => (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onChange({ ...filters, urgencies: toggle(filters.urgencies, option) })
                }
                aria-pressed={filters.urgencies.includes(option)}
                className={toggleButtonClass(filters.urgencies.includes(option))}
              >
                {fr.urgency[option]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-neutral-700">{fr.map.filters.statusLabel}</span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {ALL_STATUSES.map((option: KlashStatus) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange({ ...filters, statuses: toggle(filters.statuses, option) })}
                aria-pressed={filters.statuses.includes(option)}
                className={toggleButtonClass(filters.statuses.includes(option))}
              >
                {fr.status[option]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-neutral-700">{fr.map.filters.periodLabel}</span>
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

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={filters.visibleAreaOnly}
            onChange={(event) => onChange({ ...filters, visibleAreaOnly: event.target.checked })}
            className="h-4 w-4 rounded border-neutral-300 text-teal-700 focus:ring-teal-700"
          />
          {fr.map.filters.visibleAreaOnly}
        </label>

        <div>
          <span className="text-sm font-medium text-neutral-700">{fr.map.filters.sortLabel}</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSortChange('recent')}
              aria-pressed={sort === 'recent'}
              className={toggleButtonClass(sort === 'recent')}
            >
              {fr.map.filters.sortRecent}
            </button>
            <button
              type="button"
              onClick={() => onSortChange('confirmed')}
              aria-pressed={sort === 'confirmed'}
              className={toggleButtonClass(sort === 'confirmed')}
            >
              {fr.map.filters.sortConfirmed}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onChange(defaultFilters)
            onSortChange('recent')
          }}
          className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.map.filters.reset}
        </button>
      </div>
    </BottomSheet>
  )
}
