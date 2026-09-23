import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'
import type { ExportKlash } from '../types/klash'

function makeKlash(overrides: Partial<ExportKlash> = {}): ExportKlash {
  return {
    id: 'k1',
    lat: 43.49,
    lng: -1.47,
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
      'id,lat,lng,category,importance,status,title,description,duplicate_of,confirmations_count,comments_count,created_at,updated_at,resolved_at',
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
    expect(dataLine.split(',')[7]).toBe('')
  })

  it('separates rows with CRLF', () => {
    const csv = toCsv([makeKlash({ id: 'a' }), makeKlash({ id: 'b' })])
    expect(csv.split('\r\n')).toHaveLength(3) // header + 2 rows
  })
})
