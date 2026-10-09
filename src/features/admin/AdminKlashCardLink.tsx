import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** The bordered, fully tappable card that links to a klash's detail page —
 * the row of both card lists on `/admin` (`TriageQueue`, `AdminKlashCardList`),
 * which lay out its content differently through `className`. */
export function AdminKlashCardLink({
  klashId,
  className,
  children,
}: {
  klashId: string
  className: string
  children: ReactNode
}) {
  return (
    <Link
      to={`/k/${klashId}`}
      className={`flex rounded-md border border-neutral-200 p-3 hover:bg-neutral-50 ${className}`}
    >
      {children}
    </Link>
  )
}
