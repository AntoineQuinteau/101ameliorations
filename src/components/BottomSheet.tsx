/** Shared shell for the map's floating panels: a card anchored to the bottom
 * of the screen, sibling of `MapContainer` rather than a Leaflet popup (see
 * KlashPreviewCard's docblock for why). `KlashPreviewCard`, `PinConfirmCard`
 * and `NewKlashPage`'s creation sheet each hand-rolled this same shell before
 * this was extracted (step 6, alongside the filters panel — a fourth copy).
 *
 * `scrollable`'s cap is in dvh, not vh: on mobile, vh is the *large*
 * viewport (browser toolbar hidden), so a 70vh sheet is taller than 70% of
 * what's actually on screen while the toolbar shows — and `NewKlashPage`
 * anchors its zoom/locate column just above this cap, in dvh too.
 *
 * `clearOfFiltersCard` is for the map's sheets while the desktop filters card
 * is open (`DesktopFiltersCard`: left-16 + w-72, so its right edge is at 22rem
 * = 352px). The sheet is then centred in what is left to the right of the
 * card instead of in the whole window, so it can't cover the card's footer.
 * Only between 768px and 1152px: from 1152px (2 × 352 + the sheet's 448) the
 * centred sheet already starts right of the card, and under 768px there isn't
 * room beside it for a usable sheet. That upper bound is written in rem
 * (72rem) like Tailwind's own breakpoints: in px, Tailwind can't order it
 * against `md` and the `md` rule wins at every width. */
export function BottomSheet({
  children,
  scrollable = false,
  clearOfFiltersCard = false,
}: {
  children: React.ReactNode
  scrollable?: boolean
  clearOfFiltersCard?: boolean
}) {
  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-[1000] mx-auto w-full max-w-md p-3 sm:bottom-4 ${
        clearOfFiltersCard ? 'md:left-88 md:w-auto min-[72rem]:left-0 min-[72rem]:w-full' : ''
      }`}
    >
      <div
        className={`rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5 ${
          scrollable ? 'max-h-[70dvh] overflow-y-auto' : ''
        }`}
      >
        {children}
      </div>
    </div>
  )
}
