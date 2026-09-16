import {
  klashCategorySchema,
  type Klash,
  type KlashCategory,
  type KlashStatus,
  type KlashUrgency,
} from '../../types/klash'

export interface KlashFilters {
  categories: KlashCategory[]
  urgencies: KlashUrgency[]
  statuses: KlashStatus[]
  /** Only klashs created on or after this date (inclusive), or `null` for no
   * lower bound. An ISO date string (yyyy-mm-dd), not a full timestamp: the
   * period filter is a day-granularity choice in the UI. */
  createdAfter: string | null
}

// klashes_in_bbox already excludes rejected/duplicate and resolved-over-90-
// days (see the migration), so this default only mirrors what the RPC
// already returns — it does not additionally narrow anything by itself.
export const ALL_STATUSES: KlashStatus[] = [
  'new',
  'acknowledged',
  'in_progress',
  'resolved',
  'rejected',
  'duplicate',
]
export const DEFAULT_STATUSES: KlashStatus[] = ALL_STATUSES.filter(
  (status) => status !== 'rejected' && status !== 'duplicate',
)
// Derived from the zod schema rather than listed by hand, so a category
// added there (the source of truth) doesn't also need updating here.
export const ALL_CATEGORIES: KlashCategory[] = [...klashCategorySchema.options]
export const ALL_URGENCIES: KlashUrgency[] = ['low', 'medium', 'high']

export const defaultFilters: KlashFilters = {
  categories: ALL_CATEGORIES,
  urgencies: ALL_URGENCIES,
  statuses: DEFAULT_STATUSES,
  createdAfter: null,
}

/** Whether `filters` is exactly the default — used to decide what's worth
 * writing to the URL (see filterParams.ts): only what differs from the
 * default needs a query param. */
export function isDefaultFilters(filters: KlashFilters): boolean {
  return (
    sameMembers(filters.categories, defaultFilters.categories) &&
    sameMembers(filters.urgencies, defaultFilters.urgencies) &&
    sameMembers(filters.statuses, defaultFilters.statuses) &&
    filters.createdAfter === defaultFilters.createdAfter
  )
}

function sameMembers<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  const bSet = new Set(b)
  return a.every((item) => bSet.has(item))
}

/** Applies every active filter to a list of klashs already loaded for the
 * viewport (client-side: see the migration's plan for why — the seeded
 * volume doesn't justify a server round trip per filter change). */
export function applyFilters(klashes: Klash[], filters: KlashFilters): Klash[] {
  return klashes.filter((klash) => {
    if (!filters.categories.includes(klash.category)) return false
    if (!filters.urgencies.includes(klash.urgency)) return false
    if (!filters.statuses.includes(klash.status)) return false
    if (filters.createdAfter && klash.createdAt < filters.createdAfter) return false
    return true
  })
}
