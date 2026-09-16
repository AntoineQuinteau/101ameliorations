import type { ExportKlash } from '../types/klash'

export interface KlashGeoJsonFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: Omit<ExportKlash, 'lat' | 'lng'>
}

export interface KlashGeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features: KlashGeoJsonFeature[]
}

/** Builds a GeoJSON FeatureCollection from export rows (spec §6.7).
 * GeoJSON coordinates are always `[longitude, latitude]` — the reverse of
 * this app's own `lat`/`lng` naming, and of `klashes_public`'s column
 * order — so this is the one place that ordering needs to be gotten right
 * explicitly. */
export function toGeoJson(rows: ExportKlash[]): KlashGeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rows.map(({ lat, lng, ...properties }) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties,
    })),
  }
}
