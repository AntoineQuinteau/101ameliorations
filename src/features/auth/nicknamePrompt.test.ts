import { describe, expect, it } from 'vitest'
import { pseudoPromptStorageKey, shouldPromptForPseudo } from './nicknamePrompt'

describe('shouldPromptForPseudo', () => {
  it('prompts when there is no pseudo and the prompt was not skipped', () => {
    expect(shouldPromptForPseudo(null, false)).toBe(true)
  })

  it('does not prompt when the prompt was already skipped', () => {
    expect(shouldPromptForPseudo(null, true)).toBe(false)
  })

  it('does not prompt when a pseudo is already set', () => {
    expect(shouldPromptForPseudo('Alice', false)).toBe(false)
  })

  it('does not prompt when a pseudo is set even if not marked skipped', () => {
    expect(shouldPromptForPseudo('Alice', true)).toBe(false)
  })
})

describe('pseudoPromptStorageKey', () => {
  it('is scoped to the user id', () => {
    expect(pseudoPromptStorageKey('user-1')).toContain('user-1')
  })

  it('is distinct across users, so a skip on one account does not silence the prompt for another', () => {
    expect(pseudoPromptStorageKey('user-1')).not.toBe(pseudoPromptStorageKey('user-2'))
  })
})
