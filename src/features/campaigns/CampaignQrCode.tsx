import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { fr } from '../../i18n/fr'
import { downloadBlob, downloadTextFile } from '../../utils/download'
import { shortUrl } from './campaignTokens'
import { qrPngBlob, qrSvg } from './qrCode'
import { useCopied } from './useCopied'

const buttonClass =
  'inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-medium'

const canCopyImage =
  typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'

/** The QR code of one link, to copy or download. It encodes the short URL,
 * never the long utm one: the destination can change later without reprinting
 * anything. Scrolls itself into view when it appears, so opening it is never
 * a click with no visible effect. */
export function CampaignQrCode({ slug }: { slug: string }) {
  const origin = window.location.origin
  const url = shortUrl(origin, slug)
  const svg = useMemo(() => qrSvg(url), [url])
  const container = useRef<HTMLDivElement>(null)
  const [imageCopied, flashImageCopied] = useCopied()
  const [error, setError] = useState<'copy' | 'png' | null>(null)
  const isOfficialOrigin = window.location.hostname === '101ameliorations.org'

  useEffect(() => {
    container.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  async function copyImage() {
    setError(null)
    try {
      // The blob is passed as a promise: Safari only accepts a clipboard write
      // started synchronously in the click handler.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': qrPngBlob(url) })])
      flashImageCopied()
    } catch {
      setError('copy')
    }
  }

  async function downloadPng() {
    setError(null)
    try {
      downloadBlob(`qr-${slug}.png`, await qrPngBlob(url))
    } catch {
      setError('png')
    }
  }

  return (
    <div ref={container} className="flex flex-col gap-3">
      {!isOfficialOrigin && (
        <p role="note" className="text-sm text-amber-700">
          {fr.campaigns.qr.testOrigin(origin)}
        </p>
      )}
      <div className="flex flex-col items-start gap-3 sm:flex-row">
        <div
          role="img"
          aria-label={fr.campaigns.qr.alt(url)}
          className="size-48 shrink-0 bg-white [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="flex flex-col items-start gap-2">
          {canCopyImage && (
            <button type="button" onClick={() => void copyImage()} className={buttonClass}>
              {imageCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {imageCopied ? fr.campaigns.qr.imageCopied : fr.campaigns.qr.copyImage}
            </button>
          )}
          <button
            type="button"
            onClick={() => downloadTextFile(`qr-${slug}.svg`, 'image/svg+xml', svg)}
            className={buttonClass}
          >
            <Download className="size-4" />
            {fr.campaigns.qr.downloadSvg}
          </button>
          <button type="button" onClick={() => void downloadPng()} className={buttonClass}>
            <Download className="size-4" />
            {fr.campaigns.qr.downloadPng}
          </button>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error === 'copy' ? fr.campaigns.qr.copyImageError : fr.campaigns.qr.pngError}
            </p>
          )}
          <p className="text-sm text-neutral-600">{fr.campaigns.qr.sizeReminder}</p>
        </div>
      </div>
    </div>
  )
}
