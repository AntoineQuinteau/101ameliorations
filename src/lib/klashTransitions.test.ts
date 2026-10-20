import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Constants } from '../types/database'
import { allowedNextStatuses, canChangeKlashStatus } from './klashTransitions'

describe('canChangeKlashStatus', () => {
  it('lets a moderator sort a new klash to rejected or duplicate', () => {
    expect(canChangeKlashStatus('moderator', 'new', 'rejected')).toBe(true)
    expect(canChangeKlashStatus('moderator', 'new', 'duplicate')).toBe(true)
  })

  it('lets a moderator return a sorted klash to new', () => {
    expect(canChangeKlashStatus('moderator', 'rejected', 'new')).toBe(true)
    expect(canChangeKlashStatus('moderator', 'duplicate', 'new')).toBe(true)
  })

  it('does not let a moderator run the processing pipeline', () => {
    expect(canChangeKlashStatus('moderator', 'new', 'acknowledged')).toBe(false)
    expect(canChangeKlashStatus('moderator', 'acknowledged', 'in_progress')).toBe(false)
    expect(canChangeKlashStatus('moderator', 'in_progress', 'resolved')).toBe(false)
    expect(canChangeKlashStatus('moderator', 'resolved', 'in_progress')).toBe(false)
  })

  it('lets an authority run the processing pipeline and reopen', () => {
    expect(canChangeKlashStatus('authority', 'new', 'acknowledged')).toBe(true)
    expect(canChangeKlashStatus('authority', 'acknowledged', 'in_progress')).toBe(true)
    expect(canChangeKlashStatus('authority', 'in_progress', 'resolved')).toBe(true)
    expect(canChangeKlashStatus('authority', 'resolved', 'in_progress')).toBe(true)
  })

  it('does not let an authority sort', () => {
    expect(canChangeKlashStatus('authority', 'new', 'rejected')).toBe(false)
    expect(canChangeKlashStatus('authority', 'new', 'duplicate')).toBe(false)
    expect(canChangeKlashStatus('authority', 'rejected', 'new')).toBe(false)
  })

  it('does not let an authority skip a step', () => {
    expect(canChangeKlashStatus('authority', 'new', 'in_progress')).toBe(false)
    expect(canChangeKlashStatus('authority', 'new', 'resolved')).toBe(false)
    expect(canChangeKlashStatus('authority', 'acknowledged', 'resolved')).toBe(false)
  })

  it('lets an admin do both a moderator and an authority transition', () => {
    expect(canChangeKlashStatus('admin', 'new', 'rejected')).toBe(true)
    expect(canChangeKlashStatus('admin', 'new', 'acknowledged')).toBe(true)
  })

  it('never lets a plain user change a status', () => {
    expect(canChangeKlashStatus('user', 'new', 'acknowledged')).toBe(false)
    expect(canChangeKlashStatus('user', 'new', 'rejected')).toBe(false)
  })

  it('never allows a status to move to itself', () => {
    expect(canChangeKlashStatus('admin', 'new', 'new')).toBe(false)
  })
})

describe('allowedNextStatuses', () => {
  it('lists both arrows out of new for an admin', () => {
    expect(allowedNextStatuses('admin', 'new').sort()).toEqual(
      ['acknowledged', 'duplicate', 'rejected'].sort(),
    )
  })

  it('is empty for a plain user regardless of status', () => {
    expect(allowedNextStatuses('user', 'new')).toEqual([])
    expect(allowedNextStatuses('user', 'resolved')).toEqual([])
  })

  it('is empty when there is no arrow out of a status for that role', () => {
    expect(allowedNextStatuses('moderator', 'acknowledged')).toEqual([])
    expect(allowedNextStatuses('authority', 'duplicate')).toEqual([])
  })
})

// The database function can_change_klash_status() is the authority. Its
// exhaustive matrix lives in supabase/tests/status_transitions_matrix_test.sql
// (checked against the real function by `supabase test db`); reading the same
// list here keeps this UI mirror from drifting, with a single copy of it.
describe('UI mirror of can_change_klash_status()', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/tests/status_transitions_matrix_test.sql'),
    'utf8',
  )
  const block = sql.split('-- BEGIN allowed transitions')[1]?.split('-- END allowed transitions')[0]
  const allowed = new Set(
    [...(block ?? '').matchAll(/\('(\w+)',\s*'(\w+)',\s*'(\w+)'\)/g)].map(
      ([, role, from, to]) => `${role}:${from}>${to}`,
    ),
  )

  it('reads the matrix from the database test', () => {
    expect(allowed.size).toBe(16)
  })

  const cases = Constants.public.Enums.user_role.flatMap((role) =>
    Constants.public.Enums.klash_status.flatMap((from) =>
      Constants.public.Enums.klash_status.map((to) => [role, from, to] as const),
    ),
  )

  it.each(cases)('%s: %s -> %s matches the database', (role, from, to) => {
    expect(canChangeKlashStatus(role, from, to)).toBe(allowed.has(`${role}:${from}>${to}`))
  })
})
