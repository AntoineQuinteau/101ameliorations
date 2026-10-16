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
  contour?: PolygonGeometry | MultiPolygonGeometry
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function fetchDepartment(code: string): Promise<CommuneInput[]> {
  const url =
    `https://geo.api.gouv.fr/communes?codeDepartement=${code}` +
    `&fields=code,nom,codeEpci,epci,contour&format=json&geometry=contour`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  const communes = (await response.json()) as ApiCommune[]
  if (!Array.isArray(communes) || communes.length === 0) {
    throw new Error(`no commune returned for département ${code}`)
  }
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
  const communes = await fetchDepartment(department)
  console.log(`département ${department}: ${communes.length} communes`)
  inputs.push(...communes)
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
