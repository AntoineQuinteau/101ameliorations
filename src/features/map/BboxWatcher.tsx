import { useEffect, useRef } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import type { LatLngBounds } from 'leaflet'
import type { Bbox } from '../../utils/bbox'

const DEBOUNCE_MS = 300

function boundsToBbox(bounds: LatLngBounds): Bbox {
  return {
    minLat: bounds.getSouth(),
    minLng: bounds.getWest(),
    maxLat: bounds.getNorth(),
    maxLng: bounds.getEast(),
  }
}

/** Reports the visible map viewport as a bbox: once on mount, then debounced 300 ms
 * (spec §6.1) after every pan/zoom. Renders nothing. */
export function BboxWatcher({ onChange }: { onChange: (bbox: Bbox) => void }) {
  const map = useMap()
  const onChangeRef = useRef(onChange)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onChangeRef.current(boundsToBbox(map.getBounds()))
  }, [map])

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  const scheduleUpdate = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      onChangeRef.current(boundsToBbox(map.getBounds()))
    }, DEBOUNCE_MS)
  }

  useMapEvents({
    moveend: scheduleUpdate,
    zoomend: scheduleUpdate,
  })

  return null
}
