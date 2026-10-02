import L from 'leaflet'

// Path data of lucide's `MapPin` icon (24x24 grid), inlined because Leaflet divIcons take an
// HTML string and rendering the React component would pull `react-dom/server` into the bundle.
const MAP_PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" ' +
  'fill="#0f766e" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" ' +
  'stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>' +
  '<circle cx="12" cy="10" r="3" fill="#ffffff" stroke="none"/></svg>'

/** Pin shown at a candidate or draggable klash position. The anchor is the pin's bottom tip
 * (`-translate-y-full`), so the tip sits exactly on the picked coordinate. */
export const PIN_ICON = L.divIcon({
  className: '',
  html: `<div class="h-9 w-9 -translate-x-1/2 -translate-y-full drop-shadow-md">${MAP_PIN_SVG}</div>`,
  iconSize: [0, 0],
})
