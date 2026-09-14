import { useEffect, useState } from 'react'
import { fr } from '../../i18n/fr'
import { useHasHover } from './useHasHover'
import type { KlashCategory, KlashStatus, KlashUrgency } from '../../types/klash'
import {
  ALL_CATEGORIES,
  ALL_STATUSES,
  ALL_URGENCIES,
  defaultFilters,
  DEFAULT_SORT,
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

/** Filters + sort panel for the map (spec §6.1). Changes are staged in a local
 * draft and only take effect on "Appliquer" (or immediately on "Réinitialiser"
 * — there's nothing to lose by seeing the default view right away): applying
 * every chip toggle straight to the map made each tap feel like it was
 * re-querying, and it isn't free either — applyFilters/sortKlashes re-run
 * over every loaded klash on each change.
 *
 * Desktop (hover-capable pointer) docks the panel to the left edge, full
 * height, so it never covers the map; mobile gets a near-full-height sheet
 * from the bottom, avoiding the scroll a shorter sheet would need for this
 * many controls. */
export function FiltersPanel({
  filters,
  sort,
  resultsCount,
  onApply,
  onClose,
}: {
  filters: KlashFilters
  sort: KlashSort
  resultsCount: number
  /** Commits filters and sort together, in one call: they must land as a
   * single state update in the parent, not two calls each closing over the
   * other's stale value (see MapPage's updateFiltersAndSort). */
  onApply: (filters: KlashFilters, sort: KlashSort) => void
  onClose: () => void
}) {
  const isDesktop = useHasHover()
  const [draftFilters, setDraftFilters] = useState(filters)
  const [draftSort, setDraftSort] = useState(sort)

  // The committed filters/sort can also change from outside (e.g. the back
  // button restoring a previous URL) — keep the draft in sync when that
  // happens rather than only ever reading the initial value.
  useEffect(() => {
    setDraftFilters(filters)
    setDraftSort(sort)
  }, [filters, sort])

  function toggleButtonClass(active: boolean): string {
    return `rounded-md border px-2 py-2 text-xs font-medium ${
      active
        ? 'border-teal-700 bg-teal-50 text-teal-800'
        : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
    }`
  }

  function handleApply() {
    onApply(draftFilters, draftSort)
    onClose()
  }

  function handleReset() {
    setDraftFilters(defaultFilters)
    setDraftSort(DEFAULT_SORT)
    onApply(defaultFilters, DEFAULT_SORT)
  }

  const content = (
    <div className="flex h-full flex-col gap-4">
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

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4">
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
                    setDraftFilters({
                      ...draftFilters,
                      categories: toggle(draftFilters.categories, option),
                    })
                  }
                  aria-pressed={draftFilters.categories.includes(option)}
                  className={toggleButtonClass(draftFilters.categories.includes(option))}
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
                    setDraftFilters({
                      ...draftFilters,
                      urgencies: toggle(draftFilters.urgencies, option),
                    })
                  }
                  aria-pressed={draftFilters.urgencies.includes(option)}
                  className={toggleButtonClass(draftFilters.urgencies.includes(option))}
                >
                  {fr.urgency[option]}
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
                    setDraftFilters({
                      ...draftFilters,
                      statuses: toggle(draftFilters.statuses, option),
                    })
                  }
                  aria-pressed={draftFilters.statuses.includes(option)}
                  className={toggleButtonClass(draftFilters.statuses.includes(option))}
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
                const active = draftFilters.createdAfter === value
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setDraftFilters({ ...draftFilters, createdAfter: value })}
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
              checked={draftFilters.visibleAreaOnly}
              onChange={(event) =>
                setDraftFilters({ ...draftFilters, visibleAreaOnly: event.target.checked })
              }
              className="h-4 w-4 rounded border-neutral-300 text-teal-700 focus:ring-teal-700"
            />
            {fr.map.filters.visibleAreaOnly}
          </label>

          <div>
            <span className="text-sm font-medium text-neutral-700">{fr.map.filters.sortLabel}</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDraftSort('recent')}
                aria-pressed={draftSort === 'recent'}
                className={toggleButtonClass(draftSort === 'recent')}
              >
                {fr.map.filters.sortRecent}
              </button>
              <button
                type="button"
                onClick={() => setDraftSort('confirmed')}
                aria-pressed={draftSort === 'confirmed'}
                className={toggleButtonClass(draftSort === 'confirmed')}
              >
                {fr.map.filters.sortConfirmed}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="flex-1 inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {fr.map.filters.reset}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 inline-flex items-center justify-center rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {fr.map.filters.apply}
        </button>
      </div>
    </div>
  )

  if (isDesktop) {
    // Docked to the left edge, full height: unlike the bottom sheets (which
    // sit as an overlay a user dismisses), the panel never covers the map on
    // a screen wide enough to show both side by side.
    return (
      <div className="absolute inset-y-0 left-0 z-[1000] w-80 max-w-[85vw] bg-white p-4 shadow-lg ring-1 ring-black/5">
        {content}
      </div>
    )
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-[1000] flex h-[92vh] flex-col rounded-t-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
      {content}
    </div>
  )
}
