import {
  klashCategorySchema,
  klashStatusSchema,
  klashImportanceSchema,
  type KlashCategory,
  type KlashStatus,
  type KlashImportance,
} from '../../types/klash'
import { defaultFilters, isDefaultFilters, type KlashFilters } from './klashFilters'

const CATEGORY_PARAM = 'category'
const IMPORTANCE_PARAM = 'importance'
const STATUS_PARAM = 'status'
const CREATED_AFTER_PARAM = 'since'

/** Parses one comma-separated URL param into a list of values valid against
 * `schema`, silently dropping anything unknown or malformed — a hand-edited
 * or stale URL must never crash the map, it should just fall back to
 * ignoring what it can't recognise. Returns `null` if the param is absent
 * (as opposed to present-but-empty) so the caller can fall back to the
 * default rather than to "no values selected". */
function parseEnumList<T extends string>(
  params: URLSearchParams,
  key: string,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
): T[] | null {
  const raw = params.get(key)
  if (raw === null) return null
  const values = raw
    .split(',')
    .map((value) => schema.safeParse(value))
    .filter((result): result is { success: true; data: T } => result.success)
    .map((result) => result.data)
  return values.length > 0 ? values : null
}

/** Reconstructs filters from the current URL, falling back to defaults for
 * anything absent or unparseable. */
export function filtersFromSearchParams(params: URLSearchParams): KlashFilters {
  const categories = parseEnumList<KlashCategory>(params, CATEGORY_PARAM, klashCategorySchema)
  const importances = parseEnumList<KlashImportance>(params, IMPORTANCE_PARAM, klashImportanceSchema)
  const statuses = parseEnumList<KlashStatus>(params, STATUS_PARAM, klashStatusSchema)
  const createdAfter = params.get(CREATED_AFTER_PARAM)

  return {
    categories: categories ?? defaultFilters.categories,
    importances: importances ?? defaultFilters.importances,
    statuses: statuses ?? defaultFilters.statuses,
    createdAfter: createdAfter && /^\d{4}-\d{2}-\d{2}$/.test(createdAfter) ? createdAfter : null,
  }
}

/** Serialises filters into URL search params, writing only what differs
 * from the default so a plain visit to `/` stays a clean URL and a shared
 * link is as short as the choices that produced it. */
export function filtersToSearchParams(filters: KlashFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (isDefaultFilters(filters)) return params

  if (!sameSet(filters.categories, defaultFilters.categories)) {
    params.set(CATEGORY_PARAM, filters.categories.join(','))
  }
  if (!sameSet(filters.importances, defaultFilters.importances)) {
    params.set(IMPORTANCE_PARAM, filters.importances.join(','))
  }
  if (!sameSet(filters.statuses, defaultFilters.statuses)) {
    params.set(STATUS_PARAM, filters.statuses.join(','))
  }
  if (filters.createdAfter) params.set(CREATED_AFTER_PARAM, filters.createdAfter)

  return params
}

function sameSet<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  const bSet = new Set(b)
  return a.every((item) => bSet.has(item))
}
