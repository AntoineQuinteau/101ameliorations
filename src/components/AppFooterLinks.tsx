import { Link } from 'react-router-dom'
import { fr } from '../i18n/fr'

/** Small, permanent entry point to the public data export (spec §6.7) and,
 * since step 9, the legal/privacy pages. Kept deliberately discreet on the
 * map: a data/legal utility, not a feature the map should draw attention to. */
export function AppFooterLinks() {
  return (
    <div className="absolute bottom-3 left-3 z-[1000] flex gap-1.5">
      <Link
        to="/export"
        className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-neutral-600 shadow hover:bg-white"
      >
        {fr.export.footerLink}
      </Link>
      <Link
        to="/mentions-legales"
        className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-neutral-600 shadow hover:bg-white"
      >
        {fr.legal.footerLink}
      </Link>
      <Link
        to="/confidentialite"
        className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-neutral-600 shadow hover:bg-white"
      >
        {fr.legal.privacy.title}
      </Link>
    </div>
  )
}
