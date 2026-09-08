import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import type { Klash } from '../../types/klash'
import { getMarkerIcon } from './markerIcons'

/** Imperative marker layer: leaflet.markercluster has no maintained React wrapper for
 * react-leaflet v4, so the cluster group is driven directly via useMap(). Markers are
 * diffed by klash id on every data change (added/removed, never rebuilt wholesale) so
 * panning across ~500 klashs doesn't reconstruct the whole layer on each render. */
export function ClusteredKlashMarkers({
  klashes,
  onSelect,
}: {
  klashes: Klash[]
  onSelect: (klash: Klash) => void
}) {
  const map = useMap()
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)
  const markersRef = useRef(new Map<string, L.Marker>())
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

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
        icon: getMarkerIcon(klash.urgency, klash.status),
      })
      marker.on('click', () => onSelectRef.current(klash))
      markers.set(klash.id, marker)
      group.addLayer(marker)
    }
  }, [klashes])

  return null
}
