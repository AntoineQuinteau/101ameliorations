import L from 'leaflet'

// Path data of lucide's `MapPin` icon (24x24 grid), inlined because Leaflet divIcons take an
// HTML string and rendering the React component would pull `react-dom/server` into the bundle.
const PIN_SIZE = 40
// The pin's tip ends at y=22 of the 24-unit grid, plus half the 1.5 stroke width. Anchoring
// there puts the visible tip exactly on the picked coordinate.
const PIN_TIP_OFFSET = (PIN_SIZE * 22.75) / 24

// Tailwind red-700 (same red as the "delete my account" link) with a red-900 outline. Distinct
// from the brighter red-600 of high-importance klash markers.
const PIN_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${PIN_SIZE}" height="${PIN_SIZE}" ` +
  'fill="#b91c1c" stroke="#7f1d1d" stroke-width="1.5" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>' +
  '<circle cx="12" cy="10" r="3"/>' +
  '</svg>'

/** Pin shown at a candidate or draggable klash position, anchored on its tip. */
export const PIN_ICON = L.divIcon({
  className: 'drop-shadow-md',
  html: PIN_SVG,
  iconSize: [PIN_SIZE, PIN_SIZE],
  iconAnchor: [PIN_SIZE / 2, PIN_TIP_OFFSET],
})
