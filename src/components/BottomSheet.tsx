/** Shared shell for the map's floating panels: a card anchored to the bottom
 * of the screen, sibling of `MapContainer` rather than a Leaflet popup (see
 * KlashPreviewCard's docblock for why). `KlashPreviewCard`, `PinConfirmCard`
 * and `NewKlashPage`'s creation sheet each hand-rolled this same shell before
 * this was extracted (step 6, alongside the filters panel — a fourth copy). */
export function BottomSheet({
  children,
  scrollable = false,
}: {
  children: React.ReactNode
  scrollable?: boolean
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-[1000] mx-auto w-full max-w-md p-3 sm:bottom-4">
      <div
        className={`rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5 ${
          scrollable ? 'max-h-[70vh] overflow-y-auto' : ''
        }`}
      >
        {children}
      </div>
    </div>
  )
}
