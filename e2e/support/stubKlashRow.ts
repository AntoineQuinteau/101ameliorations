/** One `klashes_in_bbox` row, enough for `klashFromRow` to render a marker. */
export function stubKlashRow(lat: number, lng: number) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    author_id: '00000000-0000-4000-8000-000000000002',
    lat,
    lng,
    category: 'category_1',
    category_other: null,
    importance: 'high',
    status: 'new',
    title: 'Klash de test',
    description: null,
    proposed_solution: null,
    duplicate_of: null,
    confirmations_count: 0,
    comments_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    resolved_at: null,
    author_display_name: null,
    author_organization: null,
    author_role: 'user',
  }
}
