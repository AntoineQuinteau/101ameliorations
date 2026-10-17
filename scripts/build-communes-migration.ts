// Generates the data migration that loads the `communes` reference table
// (supabase/migrations/*_communes_<year>.sql) from geo.api.gouv.fr.
//
//   node scripts/build-communes-migration.ts --cog-year 2026
//
// Run it once per year, when INSEE publishes the new commune list, and commit
// the file it writes: a new vintage is a new migration, never an edit of an
// applied one. Needs network access to geo.api.gouv.fr. Node >= 22.6 runs
// this TypeScript file directly (no build step).
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  buildMigrationSql,
  selectCommunes,
  type Bbox,
  type CommuneInput,
  type MultiPolygonGeometry,
  type PolygonGeometry,
} from './communesMigration.ts'

// Mirror of the `service_area_bbox` row in `settings`
// (20260917004435_widen_service_area.sql). Keep in sync if the area changes.
const SERVICE_AREA: Bbox = { minLat: 42.7, minLng: -2.3, maxLat: 45.0, maxLng: 0.5 }

// Départements whose territory can touch SERVICE_AREA; communes outside it are
// filtered out by their boundary, so a département listed here but barely
// inside costs nothing.
const DEPARTMENTS = ['24', '31', '32', '33', '40', '47', '64', '65', '82']

interface ApiCommune {
  code: string
  nom: string
  codeEpci?: string
  epci?: { code: string; nom: string }
  centre?: { coordinates: [number, number] }
  contour?: PolygonGeometry | MultiPolygonGeometry
}

// A commune is a few tens of km across at most: one whose centre is further
// than this from the service area cannot touch it, so its (heavy) boundary is
// never downloaded.
const CENTRE_MARGIN_DEG = 0.4

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

/** The API (or a proxy in front of it) sometimes drops a connection: retry a
 * few times with a growing pause before giving up. */
async function fetchWithRetry(url: string, attempts = 15): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url} answered ${response.status}`)
      return response
    } catch (error) {
      if (attempt >= attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * attempt, 8000)))
    }
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  return (await (await fetchWithRetry(`https://geo.api.gouv.fr/${path}`)).json()) as T
}

function nearServiceArea([lng, lat]: [number, number]): boolean {
  return (
    lng >= SERVICE_AREA.minLng - CENTRE_MARGIN_DEG &&
    lng <= SERVICE_AREA.maxLng + CENTRE_MARGIN_DEG &&
    lat >= SERVICE_AREA.minLat - CENTRE_MARGIN_DEG &&
    lat <= SERVICE_AREA.maxLat + CENTRE_MARGIN_DEG
  )
}

/** Runs `task` over `items`, at most `limit` at a time, keeping result order. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await task(items[index])
      }
    }),
  )
  return results
}

// The boundaries are fetched commune by commune: a whole département in one
// response is tens of MB, which does not survive every network path.
async function fetchDepartment(code: string): Promise<CommuneInput[]> {
  const list = await fetchJson<ApiCommune[]>(
    `communes?codeDepartement=${code}&fields=code,nom,codeEpci,epci,centre&geometry=centre`,
  )
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`no commune returned for département ${code}`)
  }
  const candidates = list.filter(
    (commune) => commune.centre && nearServiceArea(commune.centre.coordinates),
  )
  const communes = await mapPool(candidates, 4, (commune) =>
    fetchJson<ApiCommune>(
      `communes/${commune.code}?fields=code,nom,codeEpci,epci,contour&geometry=contour`,
    ),
  )
  console.log(`département ${code}: ${list.length} communes, ${candidates.length} fetched`)
  return communes.map((commune) => {
    if (!commune.contour) throw new Error(`commune ${commune.code} has no boundary`)
    return {
      code: commune.code,
      nom: commune.nom,
      codeEpci: commune.epci?.code ?? commune.codeEpci ?? null,
      epciNom: commune.epci?.nom ?? null,
      contour: commune.contour,
    }
  })
}

const cogYear = Number(argument('cog-year') ?? new Date().getUTCFullYear())
if (!Number.isInteger(cogYear)) throw new Error('--cog-year must be a year, e.g. 2026')

const inputs: CommuneInput[] = []
for (const department of DEPARTMENTS) {
  inputs.push(...(await fetchDepartment(department)))
}

const rows = selectCommunes(inputs, SERVICE_AREA)
console.log(`${rows.length} communes touch the service area`)
if (rows.length === 0) throw new Error('no commune selected: refusing to write an empty migration')

const now = new Date()
const stamp = now.toISOString().replace(/\D/g, '').slice(0, 14)
const out =
  argument('out') ??
  fileURLToPath(new URL(`../supabase/migrations/${stamp}_communes_${cogYear}.sql`, import.meta.url))
await writeFile(out, buildMigrationSql(rows, cogYear, now.toISOString().slice(0, 10)))
console.log(`wrote ${out}`)
