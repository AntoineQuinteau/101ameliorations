import { renderSVG } from 'uqr'

// Only encode preview URLs of this project: keeps the endpoint from becoming
// an open QR generator for arbitrary content.
const ALLOWED_HOST_SUFFIX = '.workers.dev'

export default {
  fetch(request: Request): Response {
    const target = new URL(request.url).searchParams.get('u')
    if (!target || target.length > 512) return new Response('missing ?u', { status: 400 })

    let parsed: URL
    try {
      parsed = new URL(target)
    } catch {
      return new Response('invalid url', { status: 400 })
    }
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
      return new Response('forbidden host', { status: 400 })
    }

    const svg = renderSVG(parsed.toString(), { border: 2, ecc: 'M', pixelSize: 8 })
    return new Response(svg, {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        // The alias URL is stable for the life of the PR, so the QR is too.
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
  },
} satisfies ExportedHandler
