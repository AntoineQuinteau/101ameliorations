import type { ExportKlash } from '../types/klash'

// snake_case, matching the database's own naming, rather than the app's
// camelCase: this file is read by people and tools outside this codebase.
const COLUMNS: Array<{ key: keyof ExportKlash; header: string }> = [
  { key: 'id', header: 'id' },
  { key: 'lat', header: 'lat' },
  { key: 'lng', header: 'lng' },
  { key: 'category', header: 'category' },
  { key: 'importance', header: 'importance' },
  { key: 'status', header: 'status' },
  { key: 'title', header: 'title' },
  { key: 'description', header: 'description' },
  { key: 'duplicateOf', header: 'duplicate_of' },
  { key: 'confirmationsCount', header: 'confirmations_count' },
  { key: 'commentsCount', header: 'comments_count' },
  { key: 'createdAt', header: 'created_at' },
  { key: 'updatedAt', header: 'updated_at' },
  { key: 'resolvedAt', header: 'resolved_at' },
]

// Excel guesses Latin-1 for a plain UTF-8 file with no BOM, garbling accented
// French text (titles, descriptions) — this makes it detect UTF-8 instead.
const BOM = '﻿'

function escapeCsvField(value: string | number | null): string {
  if (value === null) return ''
  const text = String(value)
  // RFC 4180: a field containing a comma, quote or line break must be
  // quoted, with embedded quotes doubled.
  if (/["\r\n,]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** Builds an RFC 4180 CSV from export rows (spec §6.7). */
export function toCsv(rows: ExportKlash[]): string {
  const header = COLUMNS.map((column) => column.header).join(',')
  const lines = rows.map((row) =>
    COLUMNS.map((column) => escapeCsvField(row[column.key])).join(','),
  )
  return BOM + [header, ...lines].join('\r\n')
}
