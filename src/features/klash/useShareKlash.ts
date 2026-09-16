import { useState } from 'react'
import { fr } from '../../i18n/fr'
import type { Klash } from '../../types/klash'

type ShareFeedback = 'copied' | 'error' | null

const FEEDBACK_TIMEOUT_MS = 3_000

/** Shares a klash's link (spec §6.3): the Web Share API where available
 * (mostly mobile — opens the native share sheet, where the Open Graph
 * preview from workers/app/src/index.ts shows up), falling back everywhere
 * else to copying the URL to the clipboard. A share sheet the user
 * dismissed without picking anything (`AbortError`) is treated the same as
 * a completed share — not an error worth surfacing. */
export function useShareKlash(klash: Klash | null | undefined) {
  const [feedback, setFeedback] = useState<ShareFeedback>(null)

  function showFeedback(next: ShareFeedback) {
    setFeedback(next)
    setTimeout(() => setFeedback(null), FEEDBACK_TIMEOUT_MS)
  }

  async function share() {
    if (!klash) return
    const url = `${window.location.origin}/k/${klash.id}`
    const title = fr.detail.shareTitle(klash.title)

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        showFeedback('error')
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      showFeedback('copied')
    } catch {
      showFeedback('error')
    }
  }

  return { share, feedback }
}
