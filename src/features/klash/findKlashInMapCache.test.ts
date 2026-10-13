import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { klashKeys } from '../../api/queryKeys'
import type { Klash } from '../../types/klash'
import { findKlashInMapCache } from './findKlashInMapCache'

const bbox = (minLat: number) => ({ minLat, minLng: 0, maxLat: minLat + 1, maxLng: 1 })
const klash = (id: string, title: string) => ({ id, title }) as Klash

describe('findKlashInMapCache', () => {
  it('returns nothing when no viewport holds the klash', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(klashKeys.bbox(bbox(1)), [klash('a', 'A')])
    expect(findKlashInMapCache(queryClient, 'b')).toBeUndefined()
  })

  it('returns the most recently fetched copy and its date', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(klashKeys.bbox(bbox(1)), [klash('a', 'old')], { updatedAt: 1000 })
    queryClient.setQueryData(klashKeys.bbox(bbox(2)), [klash('a', 'new')], { updatedAt: 2000 })
    expect(findKlashInMapCache(queryClient, 'a')).toEqual({
      klash: klash('a', 'new'),
      updatedAt: 2000,
    })
  })

  it('ignores other klash queries', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(klashKeys.detail('a'), klash('a', 'A'))
    expect(findKlashInMapCache(queryClient, 'a')).toBeUndefined()
  })
})
