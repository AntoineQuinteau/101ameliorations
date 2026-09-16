import { supabase } from '../lib/supabase'
import { exportKlashFromRow, type ExportKlash } from '../types/klash'

// PostgREST's own row cap (supabase/config.toml: `max_rows = 1000`) forces
// pagination regardless of what we ask for, so this just names that number
// rather than guessing at a different page size.
const EXPORT_PAGE_SIZE = 1000

// Guards against an unbounded loop if something (a bug here, a future RLS
// change) ever makes every page look "full". At this cap the export would
// already cover 500k klashes — far beyond anything this app will ever hold.
const MAX_PAGES = 500

const EXPORT_COLUMNS =
  'id, lat, lng, category, urgency, status, title, description, duplicate_of, confirmations_count, comments_count, created_at, updated_at, resolved_at'

/** Fetches every klash for the public export (spec §6.7), paginating over
 * `klashes_public` rather than a dedicated RPC — the view is already
 * `select`-granted to `anon`, and PostgREST's own row cap forces pagination
 * either way. Columns are projected explicitly to exclude every author
 * column the view carries (`author_id`, `author_display_name`,
 * `author_organization`, `author_role`): the export must carry no personal
 * data, and `klashFromRow`/`Klash` require those columns, so this uses the
 * narrower `exportKlashFromRow`/`ExportKlash` pair instead.
 *
 * `onProgress` is called after each page with the running total, so the UI
 * can show something better than a static spinner while a large export
 * downloads. */
export async function fetchAllKlashesForExport(
  onProgress?: (loadedCount: number) => void,
): Promise<ExportKlash[]> {
  const rows: ExportKlash[] = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * EXPORT_PAGE_SIZE
    const { data, error } = await supabase
      .from('klashes_public')
      .select(EXPORT_COLUMNS)
      .order('created_at', { ascending: false })
      .range(from, from + EXPORT_PAGE_SIZE - 1)
    if (error) throw error

    rows.push(...data.map(exportKlashFromRow))
    onProgress?.(rows.length)

    if (data.length < EXPORT_PAGE_SIZE) break
  }

  return rows
}
