/** Triggers a browser download of in-memory text content (spec §6.7's CSV
 * and GeoJSON exports) with no server round-trip: a Blob URL plus a
 * synthetic, off-DOM `<a download>` click. The object URL is revoked shortly
 * after rather than immediately — some browsers read it asynchronously, and
 * revoking too early can silently drop the download. */
export function downloadTextFile(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
