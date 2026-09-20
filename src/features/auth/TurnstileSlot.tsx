import type { MutableRefObject } from 'react'
import { fr } from '../../i18n/fr'

/**
 * The in-form home of the invisible Turnstile widget (see `useTurnstile`).
 *
 * Always mounted, because Turnstile renders into this element on every send
 * — but it occupies no space and says nothing until Cloudflare asks for an
 * interactive challenge, so the ordinary invisible path is unchanged
 * visually. When `isInteractive` turns true the user gets a label and a
 * visible checkbox to complete; rendering it off-screen instead is what
 * used to strand those visitors on "Envoi en cours…" forever.
 */
export function TurnstileSlot({
  containerRef,
  isInteractive,
}: {
  containerRef: MutableRefObject<HTMLDivElement | null>
  isInteractive: boolean
}) {
  return (
    <div className={isInteractive ? 'flex flex-col gap-2' : undefined}>
      {isInteractive && (
        <p className="text-sm text-neutral-700">{fr.login.turnstile.interactive}</p>
      )}
      <div ref={containerRef} />
    </div>
  )
}
