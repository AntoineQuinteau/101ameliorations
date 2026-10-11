import { useEffect, useRef, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CircleQuestionMark, X } from 'lucide-react'
import { BottomSheet } from '../../components/BottomSheet'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { fr } from '../../i18n/fr'

// Labelled with the titles of the pages they open, so a rename follows.
const ROWS = [
  { to: '/export', label: fr.export.title, hint: fr.about.exportHint },
  { to: '/mentions-legales', label: fr.legal.notice.title, hint: null },
  { to: '/confidentialite', label: fr.legal.privacy.title, hint: null },
] as const

/** "À propos" sheet (spec §6.1): the one place the map keeps its secondary
 * links — the public data export (§6.7) and the legal/privacy pages — so they
 * stay one tap away without taking up the bottom of the screen. A
 * `BottomSheet` like the map's other panels.
 *
 * Keyboard and screen-reader support: it is a (non-modal: the map stays
 * usable) dialog named by its title; focus moves to the title when it opens,
 * and Escape or the close button put focus back on `returnFocusRef`, the
 * control that opens it. That is passed in rather than read from
 * `document.activeElement`: Safari doesn't focus a button on click, so the
 * active element would be `<body>`. Focus is deliberately not restored when
 * something else closes the sheet (another map control was pressed), which
 * would steal it from that control. */
export function AboutSheet({
  onClose,
  onShowWelcome,
  returnFocusRef,
}: {
  onClose: () => void
  /** Reopens the first-visit welcome dialog (spec §6.1); the caller also
   * closes this sheet. */
  onShowWelcome: () => void
  returnFocusRef: RefObject<HTMLElement | null>
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  function close() {
    onClose()
    returnFocusRef.current?.focus()
  }

  useEscapeKey(close)

  return (
    <BottomSheet>
      <div role="dialog" aria-labelledby="about-sheet-title">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="about-sheet-title"
            ref={titleRef}
            tabIndex={-1}
            className="text-lg font-semibold text-neutral-900 focus:outline-none"
          >
            {fr.about.title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={fr.common.close}
            className="shrink-0 text-neutral-400 hover:text-neutral-600"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-neutral-600">{fr.about.description}</p>

        {/* Kept out of the list below, which only holds links to pages: this
            opens a dialog over the map. Looks like a text link, but is 44px
            tall and padded sideways so it stays an easy tap target. */}
        <button
          type="button"
          onClick={onShowWelcome}
          className="-mx-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-teal-700 hover:bg-teal-50 hover:text-teal-800"
        >
          <CircleQuestionMark className="size-4 shrink-0" aria-hidden />
          {fr.about.howItWorks}
        </button>

        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {ROWS.map((row) => (
            <li key={row.to}>
              <Link
                to={row.to}
                className="flex items-center justify-between gap-3 px-3 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
              >
                <span>
                  {row.label}
                  {row.hint && (
                    <span className="ml-2 text-xs font-normal text-neutral-500">{row.hint}</span>
                  )}
                </span>
                <ChevronRight className="size-4 shrink-0 text-neutral-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  )
}
