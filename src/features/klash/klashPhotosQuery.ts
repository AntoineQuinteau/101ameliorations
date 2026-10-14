import { queryOptions } from '@tanstack/react-query'
import { fetchKlashPhotos } from '../../api/klashPhotos'
import { klashKeys } from '../../api/queryKeys'

/** The photos of a klash, shared by everything that reads them (gallery, editor) and by
 * the map's hover prefetch, so they all hit one cache entry. */
export function klashPhotosQuery(klashId: string) {
  return queryOptions({
    queryKey: klashKeys.photos(klashId),
    queryFn: () => fetchKlashPhotos(klashId),
  })
}
