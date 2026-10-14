import { useEffect, useId, useRef } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { fr } from '../../i18n/fr'
import type { KlashCategory, KlashStatus, KlashImportance } from '../../types/klash'
import {
  ALL_CATEGORIES,
  ALL_IMPORTANCES,
  ALL_PERIODS,
  MAP_STATUSES,
  defaultFilters,
  isDefaultFilters,
  type KlashFilters,
  type KlashPeriod,
} from './klashFilters'
import { X } from 'lucide-react'

const PERIOD_OPTIONS: (KlashPeriod | null)[] = [null, ...ALL_PERIODS]

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
 * chip is toggled (see MapPage) — the main button only dismisses the sheet,
 * it does not itself change anything; it carries the live count because the
 * sheet hides the map the count describes. In each chip group an empty
 * selection shows everything (see `KlashFilters`).
 *
 * Both actions sit in the footer, in thumb reach and 44px tall, with the
 * reset one only enabled once something is actually narrowed. The data
 * export link the desktop card ends with is left out here (spec §6.7): a
 * small link under the main button is an easy mis-tap, and on mobile the
 * About sheet already offers it as a full-height row.
 *
 * Keyboard and screen-reader support, like `AboutSheet`: a dialog named by
 * its title, which takes focus on open; Escape closes it. The caller puts
 * focus back on the filters button, which is unmounted while this is open. */
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
  const id = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEscapeKey(onClose)

  return (
    // dvh, not vh: on mobile, vh is the viewport with the browser toolbar
    // hidden, so a 92vh sheet can push its footer under the toolbar.
    <div
      role="dialog"
      aria-labelledby={`${id}-title`}
      className="absolute inset-x-0 bottom-0 z-[1000] flex h-[92dvh] flex-col rounded-t-xl bg-white p-4 shadow-lg ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between">
        <h2
          id={`${id}-title`}
          ref={titleRef}
          tabIndex={-1}
          className="text-lg font-semibold text-neutral-900 focus:outline-none"
        >
          {fr.map.filters.title}
        </h2>
        {/* 44px tap target around the 20px icon; the negative margins keep
            the icon itself where it was, flush with the sheet's padding. */}
        <button
          type="button"
          onClick={onClose}
          aria-label={fr.map.filters.close}
          className="-my-3 -mr-3 flex size-11 shrink-0 items-center justify-center text-neutral-400 hover:text-neutral-600"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* The visible count is on the main button below; a button's name
          changing isn't announced, so screen readers get it from here. */}
      <p role="status" className="sr-only">
        {fr.map.resultsCount(resultsCount)}
      </p>

      <div className="mt-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4">
          <div role="group" aria-labelledby={`${id}-category`}>
            <div className="flex items-baseline justify-between gap-2">
              <span id={`${id}-category`} className="text-sm font-medium text-neutral-700">
                {fr.map.filters.categoryLabel}
              </span>
              {filters.categories.length === 0 && (
                <span className="text-sm text-neutral-500">{fr.map.filters.anyCategory}</span>
              )}
            </div>
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

          <div role="group" aria-labelledby={`${id}-importance`}>
            <div className="flex items-baseline justify-between gap-2">
              <span id={`${id}-importance`} className="text-sm font-medium text-neutral-700">
                {fr.map.filters.importanceLabel}
              </span>
              {filters.importances.length === 0 && (
                <span className="text-sm text-neutral-500">{fr.map.filters.anyImportance}</span>
              )}
            </div>
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

          <div role="group" aria-labelledby={`${id}-status`}>
            <div className="flex items-baseline justify-between gap-2">
              <span id={`${id}-status`} className="text-sm font-medium text-neutral-700">
                {fr.map.filters.statusLabel}
              </span>
              {filters.statuses.length === 0 && (
                <span className="text-sm text-neutral-500">{fr.map.filters.anyStatus}</span>
              )}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {MAP_STATUSES.map((option: KlashStatus) => (
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

          <div role="group" aria-labelledby={`${id}-period`}>
            <span id={`${id}-period`} className="text-sm font-medium text-neutral-700">
              {fr.map.filters.periodLabel}
            </span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option ?? 'any'}
                  type="button"
                  onClick={() => onChange({ ...filters, period: option })}
                  aria-pressed={filters.period === option}
                  className={toggleButtonClass(filters.period === option)}
                >
                  {option === null ? fr.map.filters.periodAny : fr.map.filters.period[option]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => onChange(defaultFilters)}
          disabled={isDefaultFilters(filters)}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:border-neutral-200 disabled:text-neutral-400 disabled:hover:bg-transparent"
        >
          {fr.map.filters.reset}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
        >
          {fr.map.filters.viewResults(resultsCount)}
        </button>
      </div>
    </div>
  )
}
