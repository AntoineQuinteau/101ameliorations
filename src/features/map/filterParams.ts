import {
  klashCategorySchema,
  klashImportanceSchema,
  type KlashCategory,
  type KlashStatus,
  type KlashImportance,
} from '../../types/klash'
import { klashPeriodSchema, mapStatusSchema, type KlashFilters } from './klashFilters'

const CATEGORY_PARAM = 'category'
const IMPORTANCE_PARAM = 'importance'
const STATUS_PARAM = 'status'
const PERIOD_PARAM = 'since'

/** Parses one comma-separated URL param into a list of values valid against
 * `schema`, silently dropping anything unknown or malformed — a hand-edited
 * or stale URL must never crash the map, it should just fall back to
 * ignoring what it can't recognise. An absent param and one with no valid
 * value both give an empty list, i.e. no restriction on that dimension. */
function parseEnumList<T extends string>(
  params: URLSearchParams,
  key: string,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
): T[] {
  const raw = params.get(key)
  if (raw === null) return []
  return raw
    .split(',')
    .map((value) => schema.safeParse(value))
    .filter((result): result is { success: true; data: T } => result.success)
    .map((result) => result.data)
}

/** Reconstructs filters from the current URL, falling back to "no
 * restriction" for anything absent or unparseable — including a `since` in
 * the absolute-date form this param used to carry. */
export function filtersFromSearchParams(params: URLSearchParams): KlashFilters {
  const period = klashPeriodSchema.safeParse(params.get(PERIOD_PARAM))

  return {
    categories: parseEnumList<KlashCategory>(params, CATEGORY_PARAM, klashCategorySchema),
    importances: parseEnumList<KlashImportance>(params, IMPORTANCE_PARAM, klashImportanceSchema),
    statuses: parseEnumList<KlashStatus>(params, STATUS_PARAM, mapStatusSchema),
    period: period.success ? period.data : null,
  }
}

/** Serialises filters into URL search params, writing only the dimensions
 * that narrow something so a plain visit to `/` stays a clean URL and a
 * shared link is as short as the choices that produced it. */
export function filtersToSearchParams(filters: KlashFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.categories.length > 0) params.set(CATEGORY_PARAM, filters.categories.join(','))
  if (filters.importances.length > 0) params.set(IMPORTANCE_PARAM, filters.importances.join(','))
  if (filters.statuses.length > 0) params.set(STATUS_PARAM, filters.statuses.join(','))
  if (filters.period) params.set(PERIOD_PARAM, filters.period)

  return params
}
