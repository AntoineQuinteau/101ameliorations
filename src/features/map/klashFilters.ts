import { z } from 'zod'
import {
  klashCategorySchema,
  klashImportanceSchema,
  klashStatusSchema,
  type Klash,
  type KlashCategory,
  type KlashStatus,
  type KlashImportance,
} from '../../types/klash'

// A rolling window, not a date: a preset stored as the date it resolved to
// on the day it was picked stops matching its own chip the next day, and a
// shared "last 7 days" link would freeze on the sender's date.
export const klashPeriodSchema = z.enum(['7d', '30d', '90d'])
export type KlashPeriod = z.infer<typeof klashPeriodSchema>
export const PERIOD_DAYS: Record<KlashPeriod, number> = { '7d': 7, '30d': 30, '90d': 90 }
export const ALL_PERIODS: KlashPeriod[] = [...klashPeriodSchema.options]

export interface KlashFilters {
  /** Each list narrows the map to its members; an empty list means "no
   * restriction" (everything shown), which is also the default. */
  categories: KlashCategory[]
  importances: KlashImportance[]
  statuses: KlashStatus[]
  /** Only klashs created within this rolling window, or `null` for no lower
   * bound. */
  period: KlashPeriod | null
}

// klashes_in_bbox never returns rejected/duplicate klashs (see the
// migration), so the map only offers the statuses it can actually show: a
// chip for either of those would toggle nothing.
export const mapStatusSchema = klashStatusSchema.exclude(['rejected', 'duplicate'])
export const MAP_STATUSES: KlashStatus[] = [...mapStatusSchema.options]
// Derived from the zod schema rather than listed by hand, so a category
// added there (the source of truth) doesn't also need updating here.
export const ALL_CATEGORIES: KlashCategory[] = [...klashCategorySchema.options]
export const ALL_IMPORTANCES: KlashImportance[] = [...klashImportanceSchema.options]

export const defaultFilters: KlashFilters = {
  categories: [],
  importances: [],
  statuses: [],
  period: null,
}

/** Whether `filters` is exactly the default, i.e. nothing is narrowed — what
 * the "filters active" badge and the reset button's enabled state hang on. */
export function isDefaultFilters(filters: KlashFilters): boolean {
  return (
    filters.categories.length === 0 &&
    filters.importances.length === 0 &&
    filters.statuses.length === 0 &&
    filters.period === null
  )
}

/** The ISO date (yyyy-mm-dd, UTC) `days` before `now`: the period filter is a
 * day-granularity choice, so the cutoff is a date, not a full timestamp. */
function daysAgoIsoDate(days: number, now: Date): string {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

/** Applies every active filter to a list of klashs already loaded for the
 * viewport (client-side: see the migration's plan for why — the seeded
 * volume doesn't justify a server round trip per filter change). */
export function applyFilters(
  klashes: Klash[],
  filters: KlashFilters,
  now: Date = new Date(),
): Klash[] {
  const createdAfter = filters.period ? daysAgoIsoDate(PERIOD_DAYS[filters.period], now) : null
  return klashes.filter((klash) => {
    if (filters.categories.length > 0 && !filters.categories.includes(klash.category)) return false
    if (filters.importances.length > 0 && !filters.importances.includes(klash.importance)) {
      return false
    }
    if (filters.statuses.length > 0 && !filters.statuses.includes(klash.status)) return false
    if (createdAfter && klash.createdAt < createdAfter) return false
    return true
  })
}
