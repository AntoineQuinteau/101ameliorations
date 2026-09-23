import { describe, expect, it } from 'vitest'
import { canDeleteKlash, canEditKlash } from './klashPermissions'
import type { KlashStatus } from '../types/klash'
import type { UserRole } from '../types/profile'

const NON_NEW_STATUSES: KlashStatus[] = [
  'acknowledged',
  'in_progress',
  'resolved',
  'rejected',
  'duplicate',
]

describe('canEditKlash', () => {
  it('lets the author edit their own klash while it is new, for every role', () => {
    const roles: UserRole[] = ['user', 'moderator', 'authority', 'admin']
    for (const role of roles) {
      expect(canEditKlash(role, true, 'new')).toBe(true)
    }
  })

  it('stops a plain user from editing once the klash leaves new', () => {
    for (const status of NON_NEW_STATUSES) {
      expect(canEditKlash('user', true, status)).toBe(false)
    }
  })

  it('stops an authority from editing their own klash once it leaves new', () => {
    for (const status of NON_NEW_STATUSES) {
      expect(canEditKlash('authority', true, status)).toBe(false)
    }
  })

  it("never lets a non-author authority edit someone else's klash, at any status", () => {
    expect(canEditKlash('authority', false, 'new')).toBe(false)
    for (const status of NON_NEW_STATUSES) {
      expect(canEditKlash('authority', false, status)).toBe(false)
    }
  })

  it("never lets a non-author plain user edit someone else's klash, at any status", () => {
    expect(canEditKlash('user', false, 'new')).toBe(false)
    for (const status of NON_NEW_STATUSES) {
      expect(canEditKlash('user', false, status)).toBe(false)
    }
  })

  it("lets moderator or admin edit anyone's klash at any status", () => {
    const staffRoles: UserRole[] = ['moderator', 'admin']
    for (const role of staffRoles) {
      expect(canEditKlash(role, false, 'new')).toBe(true)
      for (const status of NON_NEW_STATUSES) {
        expect(canEditKlash(role, false, status)).toBe(true)
      }
    }
  })

  it('is false for a signed-out or unresolved visitor', () => {
    expect(canEditKlash(null, false, 'new')).toBe(false)
  })
})

describe('canDeleteKlash', () => {
  it('lets the author delete their own klash while new, for every role', () => {
    const roles: UserRole[] = ['user', 'moderator', 'authority', 'admin']
    for (const role of roles) {
      expect(canDeleteKlash(role, true, 'new')).toBe(true)
    }
  })

  it("falls back to staff once the author's own klash leaves new", () => {
    expect(canDeleteKlash('user', true, 'acknowledged')).toBe(false)
    expect(canDeleteKlash('authority', true, 'acknowledged')).toBe(false)
    expect(canDeleteKlash('moderator', true, 'acknowledged')).toBe(true)
    expect(canDeleteKlash('admin', true, 'acknowledged')).toBe(true)
  })

  it("lets moderator or admin delete anyone's klash regardless of status", () => {
    expect(canDeleteKlash('moderator', false, 'new')).toBe(true)
    expect(canDeleteKlash('admin', false, 'resolved')).toBe(true)
  })

  it("never lets a plain user or authority delete someone else's klash", () => {
    expect(canDeleteKlash('user', false, 'new')).toBe(false)
    expect(canDeleteKlash('authority', false, 'new')).toBe(false)
  })

  it('is false for a signed-out or unresolved visitor', () => {
    expect(canDeleteKlash(null, false, 'new')).toBe(false)
  })
})
