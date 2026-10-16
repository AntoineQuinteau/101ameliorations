import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'
import type { ExportKlash } from '../types/klash'

function makeKlash(overrides: Partial<ExportKlash> = {}): ExportKlash {
  return {
    id: 'k1',
    lat: 43.49,
    lng: -1.47,
    inseeCode: '64102',
    communeName: 'Bayonne',
    epciSiren: '200067106',
    epciName: 'CA du Pays Basque',
    category: 'category_1',
    importance: 'medium',
    status: 'new',
    title: 'Nid-de-poule',
    description: null,
    duplicateOf: null,
    confirmationsCount: 0,
    commentsCount: 0,
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    resolvedAt: null,
    ...overrides,
  }
}

describe('toCsv', () => {
  it('starts with a UTF-8 BOM so Excel detects the encoding', () => {
    const csv = toCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('writes a snake_case header even with no rows', () => {
    const csv = toCsv([])
    expect(csv.slice(1)).toBe(
      'id,lat,lng,insee_code,commune,epci_siren,epci,category,importance,status,title,description,duplicate_of,confirmations_count,comments_count,created_at,updated_at,resolved_at',
    )
  })

  it('writes a plain value unquoted', () => {
    const csv = toCsv([makeKlash({ title: 'Nid-de-poule' })])
    expect(csv).toContain('Nid-de-poule')
    expect(csv).not.toContain('"Nid-de-poule"')
  })

  it('quotes a field containing a comma', () => {
    const csv = toCsv([makeKlash({ title: 'Trou, dangereux' })])
    expect(csv).toContain('"Trou, dangereux"')
  })

  it('doubles an embedded quote and wraps the field in quotes', () => {
    const csv = toCsv([makeKlash({ description: 'Il a dit "attention"' })])
    expect(csv).toContain('"Il a dit ""attention"""')
  })

  it('quotes a field containing a line break', () => {
    const csv = toCsv([makeKlash({ description: 'Ligne 1\nLigne 2' })])
    expect(csv).toContain('"Ligne 1\nLigne 2"')
  })

  it('renders null as an empty field', () => {
    const csv = toCsv([makeKlash({ description: null })])
    const [, dataLine] = csv.split('\r\n')
    expect(dataLine.split(',')[11]).toBe('')
  })

  it('writes the administrative area right after the coordinates', () => {
    const [, dataLine] = toCsv([makeKlash()]).split('\r\n')
    expect(dataLine.split(',').slice(1, 7)).toEqual([
      '43.49',
      '-1.47',
      '64102',
      'Bayonne',
      '200067106',
      'CA du Pays Basque',
    ])
  })

  it('keeps a leading zero in the INSEE code (an Ardèche or Ain commune)', () => {
    const [, dataLine] = toCsv([makeKlash({ inseeCode: '01001' })]).split('\r\n')
    expect(dataLine.split(',')[3]).toBe('01001')
  })

  it('renders a klash outside every commune with empty area fields', () => {
    const [, dataLine] = toCsv([
      makeKlash({ inseeCode: null, communeName: null, epciSiren: null, epciName: null }),
    ]).split('\r\n')
    expect(dataLine.split(',').slice(3, 7)).toEqual(['', '', '', ''])
  })

  it('separates rows with CRLF', () => {
    const csv = toCsv([makeKlash({ id: 'a' }), makeKlash({ id: 'b' })])
    expect(csv.split('\r\n')).toHaveLength(3) // header + 2 rows
  })
})
