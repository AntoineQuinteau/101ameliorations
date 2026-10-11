import { encode, renderSVG } from 'uqr'

// Four modules of quiet zone, the QR specification's minimum: scanners fail
// on a tighter margin once the code is printed on a busy background.
const BORDER = 4
const ECC = 'M'

export function qrSvg(text: string): string {
  return renderSVG(text, { ecc: ECC, border: BORDER })
}

/** A high-resolution PNG of the QR code. The size is rounded down to a whole
 * number of pixels per module, so every module edge is crisp. */
export function qrPngBlob(text: string, targetSize = 2048): Promise<Blob> {
  const { data, size } = encode(text, { ecc: ECC, border: BORDER })
  const pixelsPerModule = Math.max(1, Math.floor(targetSize / size))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size * pixelsPerModule
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('canvas unavailable'))
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#000000'
  data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) {
        context.fillRect(x * pixelsPerModule, y * pixelsPerModule, pixelsPerModule, pixelsPerModule)
      }
    }),
  )
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('png failed'))), 'image/png'),
  )
}
