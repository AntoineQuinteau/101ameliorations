import { describe, expect, it } from 'vitest'
import { diffDraftPhotoIds } from './draftPhotoStore'

describe('diffDraftPhotoIds', () => {
  it('reports nothing to do when the id sets are identical', () => {
    expect(diffDraftPhotoIds(['a', 'b'], ['a', 'b'])).toEqual({ toDelete: [], toAdd: [] })
  })

  it('reports only the newly added ids when nothing was removed', () => {
    expect(diffDraftPhotoIds(['a'], ['a', 'b', 'c'])).toEqual({
      toDelete: [],
      toAdd: ['b', 'c'],
    })
  })

  it('reports only the removed ids when nothing was added', () => {
    expect(diffDraftPhotoIds(['a', 'b', 'c'], ['a'])).toEqual({
      toDelete: ['b', 'c'],
      toAdd: [],
    })
  })

  it('reports both sides for a mixed add and remove', () => {
    expect(diffDraftPhotoIds(['a', 'b'], ['b', 'c'])).toEqual({
      toDelete: ['a'],
      toAdd: ['c'],
    })
  })

  it('reports everything removed and nothing added when the next set is empty', () => {
    expect(diffDraftPhotoIds(['a', 'b'], [])).toEqual({ toDelete: ['a', 'b'], toAdd: [] })
  })

  it('reports everything added and nothing removed from an empty starting set', () => {
    expect(diffDraftPhotoIds([], ['a', 'b'])).toEqual({ toDelete: [], toAdd: ['a', 'b'] })
  })
})
