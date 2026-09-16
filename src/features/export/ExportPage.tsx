import { Link } from 'react-router-dom'
import { ErrorMessage } from '../../components/ErrorMessage'
import { fr } from '../../i18n/fr'
import { useKlashExport } from './useKlashExport'

/** Public data export (spec §6.7): CSV and GeoJSON of every klash, with no
 * personal data (see `fetchAllKlashesForExport`). No auth guard — the route
 * is public, matching the underlying `klashes_public` read. */
export function ExportPage() {
  const { exportAs, isExporting, isError, loadedCount } = useKlashExport()

  return (
    <div className="mx-auto max-w-xl px-4 py-4">
      <Link to="/" className="text-sm font-medium text-teal-700 hover:underline">
        {fr.common.backToMap}
      </Link>

      <h1 className="mt-4 text-xl font-semibold text-neutral-900">{fr.export.title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{fr.export.body}</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => exportAs('csv')}
          disabled={isExporting}
          className="inline-flex items-center justify-center rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {fr.export.downloadCsv}
        </button>
        <button
          type="button"
          onClick={() => exportAs('geojson')}
          disabled={isExporting}
          className="inline-flex items-center justify-center rounded-md border border-teal-700 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-60"
        >
          {fr.export.downloadGeoJson}
        </button>
      </div>

      {isExporting && (
        <p role="status" className="mt-4 text-sm text-neutral-500">
          {fr.export.preparing(loadedCount)}
        </p>
      )}
      {isError && <ErrorMessage message={fr.export.error} />}
    </div>
  )
}
