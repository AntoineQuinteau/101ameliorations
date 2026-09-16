import { z } from 'zod'
import type { Bbox } from '../utils/bbox'

// Mirrors settings.value for key 'service_area_bbox' (snake_case jsonb — see
// the initial migration and enforce_service_area()). The .refine guards
// against inverted bounds entered by hand in Supabase Studio: clampBbox
// would otherwise silently collapse every map query to a zero-area box
// instead of failing loudly, so this throws and the caller falls back to
// the compile-time constant.
const serviceAreaBboxValueSchema = z
  .object({
    min_lat: z.number().min(-90).max(90),
    min_lng: z.number().min(-180).max(180),
    max_lat: z.number().min(-90).max(90),
    max_lng: z.number().min(-180).max(180),
  })
  .refine((b) => b.min_lat < b.max_lat && b.min_lng < b.max_lng, {
    message: 'service_area_bbox: min bounds must be strictly less than max bounds',
  })

/** Validates and maps a raw `settings.value` jsonb into the app's `Bbox` shape.
 *
 * Deliberately kept out of `src/api/settings.ts`, which imports `lib/supabase` — that
 * module validates `import.meta.env` at load time (`src/env.ts`), so anything pulling
 * it in fails in a test environment with no `VITE_*` vars set (CI). Every other pure
 * row-mapper in this app lives in `src/types/` for the same reason (see `klashFromRow`
 * in `klash.ts`) — keep this one here too, not back in `api/`. */
export function serviceAreaBboxFromValue(value: unknown): Bbox {
  const parsed = serviceAreaBboxValueSchema.parse(value)
  return {
    minLat: parsed.min_lat,
    minLng: parsed.min_lng,
    maxLat: parsed.max_lat,
    maxLng: parsed.max_lng,
  }
}
