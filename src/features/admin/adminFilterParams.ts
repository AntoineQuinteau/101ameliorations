import {
  klashCategorySchema,
  klashStatusSchema,
  type KlashCategory,
  type KlashStatus,
} from '../../types/klash'
import { daysAgoIso } from '../../utils/formatDate'

export type Period = 'any' | '7' | '30' | '90'

const PERIODS: Period[] = ['any', '7', '30', '90']

/** Derives the `since` ISO timestamp for a period choice. Not stored in the
 * URL itself (see `adminParamsToSearchParams`'s docblock): it's recomputed
 * from `period` on every read, so callers must memoize on `period` rather
 * than call this directly in render — `Date.now()` makes it return a new
 * value every time otherwise, which would forever invalidate the admin
 * table's query key. */
export function sinceForPeriod(period: Period): string | null {
  if (period === 'any') return null
  return daysAgoIso(Number(period))
}

export type AdminSortKey = 'created' | 'confirmations' | 'comments'
export type SortDirection = 'asc' | 'desc'

const SORT_KEYS: AdminSortKey[] = ['created', 'confirmations', 'comments']
const SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc']

export interface AdminSort {
  sort: AdminSortKey
  direction: SortDirection
}

export const defaultAdminSort: AdminSort = { sort: 'created', direction: 'desc' }

/** What a click on a sortable column header does: an inactive column becomes
 * the sort, descending first (most recent / most confirmed / most commented
 * is what a moderator reaches for); the active column flips its direction.
 * There is no "unsorted" state — "Réinitialiser" restores the default. */
export function nextSortOnHeaderClick(current: AdminSort, key: AdminSortKey): AdminSort {
  if (current.sort !== key) return { sort: key, direction: 'desc' }
  return { sort: key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
}

const SORT_COLUMNS: Record<AdminSortKey, 'created_at' | 'confirmations_count' | 'comments_count'> =
  {
    created: 'created_at',
    confirmations: 'confirmations_count',
    comments: 'comments_count',
  }

/** The `order by` list for a sort choice, as `[column, ascending]` pairs.
 * Always ends with `id`: confirmations and comments are small integers with
 * long runs of equal values (mostly 0), and `created_at` alone isn't
 * guaranteed unique either, so without a unique last key Postgres is free to
 * order ties differently between two page requests — which duplicates or
 * skips rows across pages. Ties fall back to newest first, whichever way
 * the main column goes; a date sort breaks its (rare) ties in its own
 * direction. */
export function adminSortOrder({ sort, direction }: AdminSort): [string, boolean][] {
  const ascending = direction === 'asc'
  if (sort === 'created')
    return [
      ['created_at', ascending],
      ['id', ascending],
    ]
  return [
    [SORT_COLUMNS[sort], ascending],
    ['created_at', false],
    ['id', false],
  ]
}

export interface AdminTableParams {
  status: KlashStatus | null
  category: KlashCategory | null
  period: Period
  searchText: string
  sort: AdminSortKey
  direction: SortDirection
  /** 0-based, matching the rest of the app's pagination state — the URL
   * itself uses 1-based page numbers (see `PAGE_PARAM` below). */
  page: number
}

export const defaultAdminTableParams: AdminTableParams = {
  status: null,
  category: null,
  period: 'any',
  searchText: '',
  sort: defaultAdminSort.sort,
  direction: defaultAdminSort.direction,
  page: 0,
}

const STATUS_PARAM = 'status'
const CATEGORY_PARAM = 'category'
const PERIOD_PARAM = 'period'
const SEARCH_PARAM = 'q'
const SORT_PARAM = 'sort'
const DIRECTION_PARAM = 'dir'
const PAGE_PARAM = 'page'

/** Reconstructs the admin table's filters/page from the current URL,
 * falling back to defaults for anything absent or unparseable — a
 * hand-edited or stale URL must never crash the page, it should just fall
 * back to ignoring what it can't recognise (same rule as the map's
 * `filterParams.ts`, which this mirrors). Ignores any other param (e.g.
 * `tab`, owned by `AdminPage`) already on the URL. */
export function adminParamsFromSearchParams(params: URLSearchParams): AdminTableParams {
  const rawStatus = params.get(STATUS_PARAM)
  const status = rawStatus ? klashStatusSchema.safeParse(rawStatus) : null
  const rawCategory = params.get(CATEGORY_PARAM)
  const category = rawCategory ? klashCategorySchema.safeParse(rawCategory) : null
  const rawPeriod = params.get(PERIOD_PARAM)
  const period = rawPeriod && PERIODS.includes(rawPeriod as Period) ? (rawPeriod as Period) : null
  // Each of sort/dir falls back to its default on its own: an unknown
  // direction must not discard a valid column, nor the reverse.
  const rawSort = params.get(SORT_PARAM)
  const sort = SORT_KEYS.find((key) => key === rawSort)
  const rawDirection = params.get(DIRECTION_PARAM)
  const direction = SORT_DIRECTIONS.find((value) => value === rawDirection)
  const rawPage = params.get(PAGE_PARAM)
  // Strict all-digits check before parsing: `Number.parseInt` alone would
  // accept trailing junk ("2abc" → 2) or exponential notation ("1e3" → 1),
  // silently misreading a malformed URL instead of falling back to the
  // default as the rest of this parser does.
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : NaN
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage - 1 : null

  return {
    status: status?.success ? status.data : defaultAdminTableParams.status,
    category: category?.success ? category.data : defaultAdminTableParams.category,
    period: period ?? defaultAdminTableParams.period,
    searchText: params.get(SEARCH_PARAM) ?? defaultAdminTableParams.searchText,
    sort: sort ?? defaultAdminTableParams.sort,
    direction: direction ?? defaultAdminTableParams.direction,
    page: page ?? defaultAdminTableParams.page,
  }
}

/** Writes the admin table's filters/page onto `current`, keeping every
 * other param (notably `tab`, owned by `AdminPage`) untouched, and writing
 * only what differs from the default so a plain visit to `/admin` stays a
 * clean URL and a shared link is as short as the choices that produced it.
 *
 * `period`, not the `since` date it derives, is what's written: `since` is
 * computed from `Date.now()` (see `sinceForPeriod`), so storing it verbatim
 * would make a link shared today read differently tomorrow.
 *
 * Callers pass this to `setSearchParams` as an updater function
 * (`setSearchParams((current) => adminParamsToSearchParams(current, next))`)
 * so it always merges onto the latest URL rather than a stale snapshot. */
export function adminParamsToSearchParams(
  current: URLSearchParams,
  params: AdminTableParams,
): URLSearchParams {
  const next = new URLSearchParams(current)

  setOrDelete(next, STATUS_PARAM, params.status)
  setOrDelete(next, CATEGORY_PARAM, params.category)
  setOrDelete(
    next,
    PERIOD_PARAM,
    params.period === defaultAdminTableParams.period ? null : params.period,
  )
  setOrDelete(next, SEARCH_PARAM, params.searchText.trim().length > 0 ? params.searchText : null)
  setOrDelete(next, SORT_PARAM, params.sort === defaultAdminTableParams.sort ? null : params.sort)
  setOrDelete(
    next,
    DIRECTION_PARAM,
    params.direction === defaultAdminTableParams.direction ? null : params.direction,
  )
  setOrDelete(next, PAGE_PARAM, params.page > 0 ? String(params.page + 1) : null)

  return next
}

function setOrDelete(params: URLSearchParams, key: string, value: string | null) {
  if (value === null) {
    params.delete(key)
  } else {
    params.set(key, value)
  }
}

export type AdminTab = 'klashes' | 'triage' | 'roles' | 'campaigns'

const TAB_PARAM = 'tab'
const ADMIN_TABS: AdminTab[] = ['klashes', 'triage', 'roles', 'campaigns']

/** Reads the active `/admin` tab from the URL, falling back to `klashes`
 * for anything absent or unrecognised. Does not on its own account for
 * `roles` being admin-only — a non-admin's `?tab=roles` link is handled by
 * the caller, since only it knows whether the role has resolved yet. */
export function adminTabFromSearchParams(params: URLSearchParams): AdminTab {
  const raw = params.get(TAB_PARAM)
  return raw && ADMIN_TABS.includes(raw as AdminTab) ? (raw as AdminTab) : 'klashes'
}

/** Writes the active tab onto `current`, keeping every other param (the
 * table's filters/page, owned by `AdminKlashTable`) untouched, and omitting
 * the default (`klashes`) so a plain visit to `/admin` stays a clean URL.
 * Same updater-function usage as `adminParamsToSearchParams`. */
export function adminTabToSearchParams(current: URLSearchParams, tab: AdminTab): URLSearchParams {
  const next = new URLSearchParams(current)
  setOrDelete(next, TAB_PARAM, tab === 'klashes' ? null : tab)
  return next
}
