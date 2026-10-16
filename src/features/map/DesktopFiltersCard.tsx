import { useId } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
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

const PERIOD_OPTIONS: (KlashPeriod | null)[] = [null, ...ALL_PERIODS]

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
 * transparent floating card next to the filters button — same family as the
 * other floating cards (KlashPreviewCard, PinConfirmCard), not a full-height
 * docked panel, so it never takes more room than its own content and the map
 * stays visible around and beneath it. Filters apply live, same as mobile —
 * there's nothing to "apply", so no button for it. In each chip group an
 * empty selection shows everything (see `KlashFilters`), so the reset button
 * is only enabled once something is actually narrowed.
 *
 * Closes with its own close button or Escape, as well as with the filters
 * button that opened it — like `AboutSheet`, and unlike it not with a click
 * on the map: this card is meant to stay open while the map is explored.
 * The reset button sits in the footer, as on mobile, so it doesn't share
 * the header's corner with the close button.
 *
 * Always mounted (unlike the mobile sheet, which only exists while open):
 * `isOpen` drives an opacity/scale transition instead of a mount/unmount, so
 * showing and hiding the card is an animated transition rather than a hard
 * cut. `inert` keeps it out of the accessibility tree, the tab order and
 * pointer hit-testing while closed, matching the visual state; `invisible`
 * (which the transition flips only once the fade-out ends) does the same for
 * anything that doesn't honour `inert` — the card now holds a "Fermer"
 * button that must not be findable while it is closed. */
export function DesktopFiltersCard({
  isOpen,
  filters,
  resultsCount,
  onChange,
  onClose,
}: {
  isOpen: boolean
  filters: KlashFilters
  resultsCount: number
  onChange: (filters: KlashFilters) => void
  onClose: () => void
}) {
  const id = useId()
  // The card is always mounted: it only listens for Escape while open.
  useEscapeKey(onClose, isOpen)
  return (
    <div
      inert={!isOpen}
      // max-w accounts for the left-16 (64px) offset plus a 12px right-hand
      // margin: w-72 (288px) alone pushes the card's right edge past the
      // viewport on anything narrower than ~427px (64 + 288 + 12 = 364, but
      // a fine-pointer/hover viewport can be as narrow as an iPad in Slide
      // Over at 320px) — a fixed percentage of the viewport (85vw) doesn't
      // account for that fixed left offset at all, so it still overflowed.
      className={`absolute top-16 left-16 z-[1000] flex w-72 max-w-[calc(100vw-5rem)] max-h-[calc(100dvh-5rem)] flex-col origin-top-left rounded-xl bg-white/85 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition-all duration-150 ease-out ${
        isOpen
          ? 'visible translate-y-0 scale-100 opacity-100'
          : 'invisible -translate-y-1 scale-95 opacity-0'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p role="status" className="text-sm font-medium text-neutral-700">
          {fr.map.resultsCount(resultsCount)}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={fr.map.filters.close}
          className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:text-neutral-600"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Only the chips scroll when the window is too short for the card:
          the close button above and the reset button below stay in reach. */}
      <div className="mt-2 flex min-h-0 flex-col gap-2 overflow-y-auto">
        <div role="group" aria-labelledby={`${id}-category`}>
          <div className="flex items-baseline justify-between gap-2">
            <span id={`${id}-category`} className="text-xs font-medium text-neutral-500">
              {fr.map.filters.categoryLabel}
            </span>
            {filters.categories.length === 0 && (
              <span className="text-xs text-neutral-500">{fr.map.filters.anyCategory}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
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
            <span id={`${id}-importance`} className="text-xs font-medium text-neutral-500">
              {fr.map.filters.importanceLabel}
            </span>
            {filters.importances.length === 0 && (
              <span className="text-xs text-neutral-500">{fr.map.filters.anyImportance}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
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
            <span id={`${id}-status`} className="text-xs font-medium text-neutral-500">
              {fr.map.filters.statusLabel}
            </span>
            {filters.statuses.length === 0 && (
              <span className="text-xs text-neutral-500">{fr.map.filters.anyStatus}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {MAP_STATUSES.map((option: KlashStatus) => (
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

        <div role="group" aria-labelledby={`${id}-period`}>
          <span id={`${id}-period`} className="text-xs font-medium text-neutral-500">
            {fr.map.filters.periodLabel}
          </span>
          <div className="mt-1 flex flex-wrap gap-1.5">
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

      <div className="mt-3 flex shrink-0 items-baseline justify-between gap-3">
        <button
          type="button"
          onClick={() => onChange(defaultFilters)}
          disabled={isDefaultFilters(filters)}
          className="shrink-0 text-xs font-medium text-teal-700 hover:underline disabled:cursor-default disabled:text-neutral-400 disabled:no-underline"
        >
          {fr.map.filters.reset}
        </button>
        <Link
          to="/export"
          className="text-right text-xs font-medium text-neutral-500 hover:text-neutral-700 hover:underline"
        >
          {fr.map.filters.exportLink}
        </Link>
      </div>
    </div>
  )
}
