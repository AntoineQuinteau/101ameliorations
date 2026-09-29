import { Circle, CircleMarker } from 'react-leaflet'

/** "You are here" dot for the map, drawn once `MapZoomLocateControls`' locate
 * button has found a position — same visual convention as Google/Apple Maps
 * (a solid blue dot with a faint accuracy halo). `interactive={false}` on
 * both: it's a status indicator, not something to click or that should steal
 * a tap from `MapClickToReport`. */
export function UserPositionMarker({
  position,
  accuracyM,
}: {
  position: [number, number]
  accuracyM: number | null
}) {
  return (
    <>
      {accuracyM !== null && accuracyM > 0 && (
        <Circle
          center={position}
          radius={accuracyM}
          interactive={false}
          pathOptions={{ color: '#0ea5e9', weight: 1, fillColor: '#0ea5e9', fillOpacity: 0.12 }}
        />
      )}
      <CircleMarker
        center={position}
        radius={7}
        interactive={false}
        pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#0ea5e9', fillOpacity: 1 }}
      />
    </>
  )
}
