// Pure helpers behind scripts/build-communes-migration.ts: shrink commune
// boundaries and render them as the SQL of a `communes` data migration. No
// network, no filesystem — everything here is unit-tested.

export type Position = [number, number]
export type Ring = Position[]

export interface PolygonGeometry {
  type: 'Polygon'
  coordinates: Ring[]
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: Ring[][]
}

export interface CommuneInput {
  code: string
  nom: string
  codeEpci: string | null
  epciNom: string | null
  contour: PolygonGeometry | MultiPolygonGeometry
}

export interface Bbox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

/** Boundaries are simplified to about 10 m and rounded to 5 decimals (about
 * 1 m): enough for "which commune is this pin in", a fraction of the raw size.
 * The 100 m nearest-commune fallback in find_commune() absorbs the slivers
 * this leaves between neighbours. */
export const SIMPLIFY_TOLERANCE_DEG = 0.0001
const COORDINATE_DECIMALS = 5

const INSEE_CODE = /^([0-9]{2}|2[AB])[0-9]{3}$/
const SIREN = /^[0-9]{9}$/

function round(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS
  return Math.round(value * factor) / factor
}

function distanceToSegment(point: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point[0] - a[0], point[1] - a[1])
  const t = Math.max(
    0,
    Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared),
  )
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy))
}

/** Douglas–Peucker on an open polyline; iterative, so a ring of a hundred
 * thousand points cannot overflow the call stack. Keeps both end points. */
function simplifyPath(path: Position[], tolerance: number): Position[] {
  if (path.length <= 2) return path
  const keep = new Array<boolean>(path.length).fill(false)
  keep[0] = true
  keep[path.length - 1] = true
  const stack: Array<[number, number]> = [[0, path.length - 1]]
  while (stack.length > 0) {
    const [start, end] = stack.pop()!
    let farthest = -1
    let farthestDistance = tolerance
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToSegment(path[i], path[start], path[end])
      if (distance > farthestDistance) {
        farthest = i
        farthestDistance = distance
      }
    }
    if (farthest !== -1) {
      keep[farthest] = true
      stack.push([start, farthest], [farthest, end])
    }
  }
  return path.filter((_, i) => keep[i])
}

/** Simplifies a closed ring (first point = last point). Returns null when too
 * few points survive to be a ring (a sliver thinner than the tolerance). The
 * ring is split at the point farthest from its start so that neither half is
 * a degenerate start-equals-end path. */
export function simplifyRing(ring: Ring, tolerance: number): Ring | null {
  const open = ring.slice(0, -1)
  if (open.length < 3) return null

  let split = 1
  let splitDistance = -1
  for (let i = 1; i < open.length; i++) {
    const distance = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1])
    if (distance > splitDistance) {
      split = i
      splitDistance = distance
    }
  }

  const first = simplifyPath(open.slice(0, split + 1), tolerance)
  const second = simplifyPath([...open.slice(split), open[0]], tolerance)
  const closed = [...first, ...second.slice(1)].map((p): Position => [round(p[0]), round(p[1])])

  // Rounding can make neighbours identical; a ring needs 4 distinct-enough
  // positions (3 corners + closing point).
  const deduped = closed.filter(
    (p, i) => i === 0 || p[0] !== closed[i - 1][0] || p[1] !== closed[i - 1][1],
  )
  return deduped.length >= 4 ? deduped : null
}

/** A Polygon or MultiPolygon as MultiPolygon coordinates, every ring
 * simplified. A polygon whose outer ring vanishes is dropped, a vanishing hole
 * too. Null when nothing is left. */
export function simplifyToMultiPolygon(
  geometry: PolygonGeometry | MultiPolygonGeometry,
  tolerance: number = SIMPLIFY_TOLERANCE_DEG,
): Ring[][] | null {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const result: Ring[][] = []
  for (const polygon of polygons) {
    const [outer, ...holes] = polygon
    const simplifiedOuter = outer ? simplifyRing(outer, tolerance) : null
    if (!simplifiedOuter) continue
    const simplifiedHoles = holes
      .map((hole) => simplifyRing(hole, tolerance))
      .filter((hole): hole is Ring => hole !== null)
    result.push([simplifiedOuter, ...simplifiedHoles])
  }
  return result.length > 0 ? result : null
}

export function boundsOf(polygons: Ring[][]): Bbox {
  const bounds: Bbox = { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity }
  for (const polygon of polygons) {
    for (const [lng, lat] of polygon[0]) {
      bounds.minLng = Math.min(bounds.minLng, lng)
      bounds.maxLng = Math.max(bounds.maxLng, lng)
      bounds.minLat = Math.min(bounds.minLat, lat)
      bounds.maxLat = Math.max(bounds.maxLat, lat)
    }
  }
  return bounds
}

export function boundsIntersect(a: Bbox, b: Bbox): boolean {
  return (
    a.minLng <= b.maxLng && a.maxLng >= b.minLng && a.minLat <= b.maxLat && a.maxLat >= b.minLat
  )
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export interface CommuneRow {
  inseeCode: string
  name: string
  epciSiren: string | null
  epciName: string | null
  polygons: Ring[][]
}

/** Keeps the communes whose (simplified) outline touches `area`, drops the
 * rest, and returns them sorted by INSEE code so the generated file is stable
 * from one run to the next. Throws on a code the API should never return
 * rather than writing it into SQL. */
export function selectCommunes(communes: CommuneInput[], area: Bbox): CommuneRow[] {
  const rows: CommuneRow[] = []
  for (const commune of communes) {
    if (!INSEE_CODE.test(commune.code)) {
      throw new Error(`unexpected INSEE code ${JSON.stringify(commune.code)}`)
    }
    if (commune.codeEpci !== null && !SIREN.test(commune.codeEpci)) {
      throw new Error(`unexpected EPCI SIREN ${JSON.stringify(commune.codeEpci)}`)
    }
    const polygons = simplifyToMultiPolygon(commune.contour)
    if (!polygons || !boundsIntersect(boundsOf(polygons), area)) continue
    rows.push({
      inseeCode: commune.code,
      name: commune.nom,
      epciSiren: commune.codeEpci,
      epciName: commune.codeEpci === null ? null : commune.epciNom,
      polygons,
    })
  }
  return rows.sort((a, b) => a.inseeCode.localeCompare(b.inseeCode))
}

/** The data migration: replaces the whole `communes` table with one COG
 * vintage, then recomputes every klash's area from it. */
export function buildMigrationSql(
  rows: CommuneRow[],
  cogYear: number,
  generatedOn: string,
): string {
  const values = rows.map((row) => {
    const geojson = JSON.stringify({ type: 'MultiPolygon', coordinates: row.polygons })
    return (
      `  (${sqlString(row.inseeCode)}, ${sqlString(row.name)}, ` +
      `${row.epciSiren === null ? 'null' : sqlString(row.epciSiren)}, ` +
      `${row.epciName === null ? 'null' : sqlString(row.epciName)}, ${cogYear},\n` +
      `   extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(${sqlString(geojson)}), 4326)))`
    )
  })

  return [
    `-- Communes reference data, COG ${cogYear}: ${rows.length} communes touching the service area.`,
    `-- Generated on ${generatedOn} by scripts/build-communes-migration.ts from geo.api.gouv.fr`,
    `-- (INSEE code, name, EPCI; Admin Express boundaries by IGN, Licence Ouverte 2.0).`,
    `-- Boundaries simplified to about 10 m. Do not edit by hand: re-run the script.`,
    ``,
    `delete from public.communes;`,
    ``,
    `insert into public.communes (insee_code, name, epci_siren, epci_name, cog_year, geom) values`,
    values.join(',\n') + ';',
    ``,
    `-- Simplifying a contour can make it touch itself; repair those (rare) outlines.`,
    `update public.communes`,
    `   set geom = extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(geom), 3))`,
    ` where not extensions.st_isvalid(geom);`,
    ``,
    `-- Existing klashes get their area from the new vintage.`,
    `select public.refresh_klash_admin_areas();`,
    ``,
  ].join('\n')
}
