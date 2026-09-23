import L from 'leaflet'
import type { KlashStatus, KlashImportance } from '../../types/klash'

export interface MarkerVariant {
  color: string
  opacity: number
}

const IMPORTANCE_COLOR: Record<KlashImportance, string> = {
  low: '#16a34a', // emerald-600
  medium: '#d97706', // amber-600
  high: '#dc2626', // red-600
}

const RESOLVED_COLOR = '#9ca3af' // neutral-400

/** Which color/opacity a marker should use for a klash's importance + status. Resolved
 * klashs are shown muted regardless of importance (spec §6.1), since they're no longer
 * actionable. Pure so it can be unit tested without touching Leaflet. */
export function getMarkerVariant(importance: KlashImportance, status: KlashStatus): MarkerVariant {
  if (status === 'resolved') {
    return { color: RESOLVED_COLOR, opacity: 0.6 }
  }
  return { color: IMPORTANCE_COLOR[importance], opacity: 1 }
}

const iconCache = new Map<string, L.DivIcon>()

/** Leaflet divIcon for a marker variant, cached so every klash sharing an
 * importance/status reuses one icon instance instead of allocating per marker. */
export function getMarkerIcon(importance: KlashImportance, status: KlashStatus): L.DivIcon {
  const variant = getMarkerVariant(importance, status)
  const key = `${variant.color}-${variant.opacity}`
  const cached = iconCache.get(key)
  if (cached) return cached

  const icon = L.divIcon({
    className: 'klash-marker',
    html: `<span class="klash-marker-dot" style="background:${variant.color};opacity:${variant.opacity}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
  iconCache.set(key, icon)
  return icon
}
