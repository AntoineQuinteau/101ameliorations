import { useQuery } from '@tanstack/react-query'
import { fetchComments } from '../../api/comments'
import { commentKeys } from '../../api/queryKeys'

/** Chronological comments on a klash (spec §6.3). */
export function useComments(klashId: string) {
  return useQuery({
    queryKey: commentKeys.byKlash(klashId),
    queryFn: () => fetchComments(klashId),
    enabled: Boolean(klashId),
  })
}
