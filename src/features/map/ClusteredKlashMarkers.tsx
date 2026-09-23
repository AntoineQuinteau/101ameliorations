import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import type { Klash } from '../../types/klash'
import { getMarkerIcon } from './markerIcons'

const HOVER_OUT_GRACE_MS = 120

/** Imperative marker layer: leaflet.markercluster has no maintained React wrapper for
 * react-leaflet v4, so the cluster group is driven directly via useMap(). Markers are
 * diffed by klash id on every data change (added/removed, never rebuilt wholesale) so
 * panning across ~500 klashs doesn't reconstruct the whole layer on each render. */
export function ClusteredKlashMarkers({
  klashes,
  onSelect,
  onHover,
}: {
  klashes: Klash[]
  onSelect: (klash: Klash) => void
  /** Desktop-only hover preview (spec follow-up): called with the hovered klash on
   * mouseover, and `null` after a short grace period once the pointer leaves — the
   * grace period is what lets moving between two close-together markers avoid a
   * flicker of the preview card closing and reopening. Optional: callers with no
   * hover behaviour (e.g. the creation sheet's contextual markers) can omit it. */
  onHover?: (klash: Klash | null) => void
}) {
  const map = useMap()
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)
  const markersRef = useRef(new Map<string, L.Marker>())
  const onSelectRef = useRef(onSelect)
  const onHoverRef = useRef(onHover)
  const hoverOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    onHoverRef.current = onHover
  }, [onHover])

  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 17,
    })
    map.addLayer(group)
    clusterGroupRef.current = group
    const markers = markersRef.current

    return () => {
      map.removeLayer(group)
      clusterGroupRef.current = null
      markers.clear()
      if (hoverOutTimerRef.current) clearTimeout(hoverOutTimerRef.current)
    }
  }, [map])

  useEffect(() => {
    const group = clusterGroupRef.current
    if (!group) return

    const markers = markersRef.current
    const seenIds = new Set(klashes.map((klash) => klash.id))

    for (const [id, marker] of markers) {
      if (!seenIds.has(id)) {
        group.removeLayer(marker)
        markers.delete(id)
      }
    }

    for (const klash of klashes) {
      if (markers.has(klash.id)) continue
      const marker = L.marker([klash.lat, klash.lng], {
        icon: getMarkerIcon(klash.importance, klash.status),
      })
      marker.on('click', () => onSelectRef.current(klash))
      marker.on('mouseover', () => {
        if (hoverOutTimerRef.current) {
          clearTimeout(hoverOutTimerRef.current)
          hoverOutTimerRef.current = null
        }
        onHoverRef.current?.(klash)
      })
      marker.on('mouseout', () => {
        if (hoverOutTimerRef.current) clearTimeout(hoverOutTimerRef.current)
        hoverOutTimerRef.current = setTimeout(() => {
          onHoverRef.current?.(null)
          hoverOutTimerRef.current = null
        }, HOVER_OUT_GRACE_MS)
      })
      markers.set(klash.id, marker)
      group.addLayer(marker)
    }
  }, [klashes])

  return null
}
