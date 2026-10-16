import { describe, expect, it } from 'vitest'
import {
  boundsIntersect,
  buildMigrationSql,
  selectCommunes,
  simplifyRing,
  simplifyToMultiPolygon,
  type CommuneInput,
  type Ring,
} from './communesMigration'

const SQUARE: Ring = [
  [0, 0],
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
]

function commune(overrides: Partial<CommuneInput> = {}): CommuneInput {
  return {
    code: '64102',
    nom: 'Bayonne',
    codeEpci: '200067106',
    epciNom: 'CA du Pays Basque',
    contour: { type: 'Polygon', coordinates: [SQUARE] },
    ...overrides,
  }
}

const AREA = { minLat: -1, minLng: -1, maxLat: 2, maxLng: 2 }

describe('simplifyRing', () => {
  it('drops collinear points and keeps the corners, closed', () => {
    const ring: Ring = [
      [0, 0],
      [0, 0.5],
      [0, 1],
      [0.5, 1],
      [1, 1],
      [1, 0.5],
      [1, 0],
      [0.5, 0],
      [0, 0],
    ]
    const simplified = simplifyRing(ring, 0.001)!
    expect(simplified[0]).toEqual(simplified[simplified.length - 1])
    expect(simplified).toHaveLength(5)
    expect(new Set(simplified.map((p) => p.join(',')))).toEqual(
      new Set(['0,0', '0,1', '1,1', '1,0']),
    )
  })

  it('keeps a point that sticks out further than the tolerance', () => {
    const ring: Ring = [
      [0, 0],
      [0, 1],
      [0.5, 1.2],
      [1, 1],
      [1, 0],
      [0, 0],
    ]
    expect(simplifyRing(ring, 0.01)).toContainEqual([0.5, 1.2])
  })

  it('rounds to 5 decimals', () => {
    const ring: Ring = [
      [0.1234567, 0.7654321],
      [0.1234567, 1.7654321],
      [1.1234567, 1.7654321],
      [0.1234567, 0.7654321],
    ]
    expect(simplifyRing(ring, 0)![0]).toEqual([0.12346, 0.76543])
  })

  it('returns null for a sliver thinner than the tolerance', () => {
    const sliver: Ring = [
      [0, 0],
      [1, 0.00001],
      [2, 0],
      [0, 0],
    ]
    expect(simplifyRing(sliver, 0.001)).toBeNull()
  })
})

describe('simplifyToMultiPolygon', () => {
  it('wraps a Polygon into MultiPolygon coordinates', () => {
    const result = simplifyToMultiPolygon({ type: 'Polygon', coordinates: [SQUARE] })!
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(1)
  })

  it('keeps every polygon of a MultiPolygon and its holes', () => {
    const hole: Ring = [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
      [0.4, 0.4],
    ]
    const result = simplifyToMultiPolygon({
      type: 'MultiPolygon',
      coordinates: [[SQUARE, hole], [SQUARE]],
    })!
    expect(result).toHaveLength(2)
    expect(result[0]).toHaveLength(2)
  })

  it('returns null when nothing survives', () => {
    const sliver: Ring = [
      [0, 0],
      [1, 0.00001],
      [2, 0],
      [0, 0],
    ]
    expect(simplifyToMultiPolygon({ type: 'Polygon', coordinates: [sliver] }, 0.001)).toBeNull()
  })
})

describe('boundsIntersect', () => {
  it('detects overlap and separation', () => {
    const a = { minLng: 0, minLat: 0, maxLng: 1, maxLat: 1 }
    expect(boundsIntersect(a, { minLng: 0.5, minLat: 0.5, maxLng: 2, maxLat: 2 })).toBe(true)
    expect(boundsIntersect(a, { minLng: 1.1, minLat: 0, maxLng: 2, maxLat: 1 })).toBe(false)
  })
})

describe('selectCommunes', () => {
  it('drops communes outside the area and sorts by INSEE code', () => {
    const far: Ring = SQUARE.map(([lng, lat]) => [lng + 10, lat + 10])
    const rows = selectCommunes(
      [
        commune({ code: '64300', nom: 'B' }),
        commune({ code: '64200', nom: 'Far', contour: { type: 'Polygon', coordinates: [far] } }),
        commune({ code: '40001', nom: 'A' }),
      ],
      AREA,
    )
    expect(rows.map((r) => r.inseeCode)).toEqual(['40001', '64300'])
  })

  it('accepts Corsican codes', () => {
    expect(selectCommunes([commune({ code: '2A004' })], AREA)).toHaveLength(1)
  })

  it('rejects a malformed INSEE code instead of writing it into SQL', () => {
    expect(() => selectCommunes([commune({ code: "1');drop table x;--" })], AREA)).toThrow(
      /INSEE code/,
    )
  })

  it('rejects a malformed SIREN', () => {
    expect(() => selectCommunes([commune({ codeEpci: 'abc' })], AREA)).toThrow(/SIREN/)
  })

  it('keeps a commune without EPCI, with null EPCI fields', () => {
    const [row] = selectCommunes([commune({ codeEpci: null, epciNom: 'ignored' })], AREA)
    expect(row.epciSiren).toBeNull()
    expect(row.epciName).toBeNull()
  })
})

describe('buildMigrationSql', () => {
  const rows = selectCommunes(
    [commune({ nom: "L'Hôpital-Saint-Blaise" }), commune({ code: '40001', codeEpci: null })],
    AREA,
  )
  const sql = buildMigrationSql(rows, 2026, '2026-10-16')

  it('replaces the table then refreshes the klashes, in that order', () => {
    expect(sql.indexOf('delete from public.communes;')).toBeLessThan(
      sql.indexOf('insert into public.communes'),
    )
    expect(sql.indexOf('insert into public.communes')).toBeLessThan(
      sql.indexOf('select public.refresh_klash_admin_areas();'),
    )
  })

  it('repairs invalid outlines before refreshing the klashes', () => {
    expect(sql.indexOf('st_makevalid')).toBeGreaterThan(sql.indexOf('insert into public.communes'))
    expect(sql.indexOf('st_makevalid')).toBeLessThan(
      sql.indexOf('select public.refresh_klash_admin_areas();'),
    )
  })

  it('doubles single quotes in names', () => {
    expect(sql).toContain("'L''Hôpital-Saint-Blaise'")
  })

  it('writes null for a missing EPCI and the vintage year on every row', () => {
    expect(sql).toMatch(/\('40001', 'Bayonne', null, null, 2026,/)
    expect(sql.match(/, 2026,/g)).toHaveLength(2)
  })

  it('embeds the boundary as GeoJSON with an SRID', () => {
    expect(sql).toContain('extensions.st_setsrid(extensions.st_geomfromgeojson(')
    expect(sql).toContain('"type":"MultiPolygon"')
    expect(sql).toContain(', 4326)))')
  })
})
