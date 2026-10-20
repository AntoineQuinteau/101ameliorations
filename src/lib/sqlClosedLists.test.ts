import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESERVED_SOURCES } from '../features/campaigns/campaignTokens'
import { INSTALL_PLATFORMS } from '../features/pwa/platform'

// Closed lists that Postgres stores as text with a check constraint, not as an
// enum, so they are absent from the generated types. The migrations below are
// already applied (and so immutable): the list the front keeps must stay in
// line with the one the database enforces.
function migration(name: string): string {
  return readFileSync(resolve(__dirname, '../../supabase/migrations', name), 'utf8')
}

/** The quoted values of the first `<anchor> in ('a', 'b', ...)` in `sql`. */
function inList(sql: string, anchor: string): string[] {
  const match = new RegExp(`${anchor}\\s+in\\s*\\(([^)]*)\\)`).exec(sql)
  return [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map(([, value]) => value)
}

describe('closed text lists shared with the database', () => {
  it('RESERVED_SOURCES is the list the database refuses', () => {
    const sql = migration('20261013090000_campaign_source_creation.sql')
    expect(inList(sql, 'source not').sort()).toEqual([...RESERVED_SOURCES].sort())
  })

  it('every reported install platform is accepted by install_events.platform', () => {
    const sql = migration('20261009110000_install_events.sql')
    const accepted = inList(sql, 'check \\(platform')
    expect(accepted.length).toBeGreaterThan(0)
    expect(accepted.filter((p) => p !== 'other').sort()).toEqual([...INSTALL_PLATFORMS].sort())
  })
})
