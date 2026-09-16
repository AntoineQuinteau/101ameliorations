import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchAllKlashesForExport } from '../../api/export'
import { toCsv } from '../../utils/csv'
import { downloadTextFile } from '../../utils/download'
import { toGeoJson } from '../../utils/geojson'

export type ExportFormat = 'csv' | 'geojson'

const FILENAME_PREFIX = 'klashs-101ameliorations'

/** Drives `/export` (spec §6.7): fetches every klash (paginated — see
 * `fetchAllKlashesForExport`), then serializes and downloads it in the
 * requested format. `loadedCount` tracks pagination progress, since a large
 * export can take several seconds and a static spinner would look stuck. */
export function useKlashExport() {
  const [loadedCount, setLoadedCount] = useState(0)

  const mutation = useMutation({
    mutationFn: async (format: ExportFormat) => {
      setLoadedCount(0)
      const rows = await fetchAllKlashesForExport(setLoadedCount)
      const date = new Date().toISOString().slice(0, 10)
      if (format === 'csv') {
        downloadTextFile(`${FILENAME_PREFIX}-${date}.csv`, 'text/csv;charset=utf-8', toCsv(rows))
      } else {
        downloadTextFile(
          `${FILENAME_PREFIX}-${date}.geojson`,
          'application/geo+json',
          JSON.stringify(toGeoJson(rows)),
        )
      }
    },
  })

  return {
    exportAs: mutation.mutate,
    isExporting: mutation.isPending,
    isError: mutation.isError,
    loadedCount,
  }
}
