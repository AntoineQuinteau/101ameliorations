import { fr } from '../../i18n/fr'
import type { KlashCategory, KlashStatus, KlashUrgency } from '../../types/klash'
import {
  ALL_CATEGORIES,
  ALL_STATUSES,
  ALL_URGENCIES,
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
  return `rounded-md border px-2 py-1.5 text-xs font-medium ${
    active
      ? 'border-teal-700 bg-teal-50 text-teal-800'
      : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
  }`
}

/** Filters card for the map on desktop (spec §6.1): a compact, semi-
 * transparent floating card in the top-left corner — same family as the
 * other floating cards (KlashPreviewCard, PinConfirmCard), not a full-height
 * docked panel, so it never takes more room than its own content and the map
 * stays visible around and beneath it. Filters apply live, same as mobile —
 * there's nothing to "apply", so no button for it.
 *
 * Always mounted (unlike the mobile sheet, which only exists while open):
 * `isOpen` drives an opacity/scale transition instead of a mount/unmount, so
 * showing and hiding the card is an animated transition rather than a hard
 * cut. `aria-hidden` + `pointer-events-none` keep it out of the accessibility
 * tree and unclickable while closed, matching the visual state. */
export function DesktopFiltersCard({
  isOpen,
  filters,
  resultsCount,
  onChange,
}: {
  isOpen: boolean
  filters: KlashFilters
  resultsCount: number
  onChange: (filters: KlashFilters) => void
}) {
  return (
    <div
      aria-hidden={!isOpen}
      className={`absolute top-14 left-3 z-[1000] w-72 max-w-[85vw] origin-top-left rounded-xl bg-white/85 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition-all duration-150 ease-out ${
        isOpen
          ? 'translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-neutral-700">{fr.map.resultsCount(resultsCount)}</p>
        <button
          type="button"
          onClick={() => onChange(defaultFilters)}
          aria-label={fr.map.filters.resetIconLabel}
          title={fr.map.filters.resetIconLabel}
          className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path
              d="M15.5 4.5A6.5 6.5 0 1 0 17 10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M17 4v4h-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
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

        <div className="flex flex-wrap gap-1.5">
          {ALL_URGENCIES.map((option: KlashUrgency) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange({ ...filters, urgencies: toggle(filters.urgencies, option) })}
              aria-pressed={filters.urgencies.includes(option)}
              className={toggleButtonClass(filters.urgencies.includes(option))}
            >
              {fr.urgency[option]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
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

        <div className="flex flex-wrap gap-1.5">
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

        <label className="flex items-center gap-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={filters.visibleAreaOnly}
            onChange={(event) => onChange({ ...filters, visibleAreaOnly: event.target.checked })}
            className="h-4 w-4 rounded border-neutral-300 text-teal-700 focus:ring-teal-700"
          />
          {fr.map.filters.visibleAreaOnly}
        </label>
      </div>
    </div>
  )
}
