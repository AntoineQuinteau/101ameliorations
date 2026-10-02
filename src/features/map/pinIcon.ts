import L from 'leaflet'

// Path data of lucide's `Pin` icon (24x24 grid), inlined because Leaflet divIcons take an
// HTML string and rendering the React component would pull `react-dom/server` into the bundle.
const PIN_SIZE = 40
// The needle ends at y=22 of the 24-unit grid, plus half the 1.5 stroke width for its round
// cap. Anchoring there puts the visible tip exactly on the picked coordinate.
const PIN_TIP_OFFSET = (PIN_SIZE * 22.75) / 24

// Brand teal, not the red used by high-importance klash markers, so a candidate pin is never
// mistaken for an existing klash.
const PIN_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${PIN_SIZE}" height="${PIN_SIZE}" ` +
  'fill="#0f766e" stroke="#134e4a" stroke-width="1.5" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 17v5"/>' +
  '<path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>' +
  '</svg>'

/** Pin shown at a candidate or draggable klash position, anchored on the needle's tip. */
export const PIN_ICON = L.divIcon({
  className: 'drop-shadow-md',
  html: PIN_SVG,
  iconSize: [PIN_SIZE, PIN_SIZE],
  iconAnchor: [PIN_SIZE / 2, PIN_TIP_OFFSET],
})
