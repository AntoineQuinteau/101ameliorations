// Generates public/og-image.png (1200×630, the standard Open Graph size)
// from the app icon: the 512×512 PWA icon centered on a brand-teal canvas.
// No text is rendered — no font can be guaranteed to load consistently
// through sharp's renderer, and the title/description carried alongside the
// image (see workers/app/src/index.ts) already say the words that matter.
//
// Run with `npm run gen:og-image` after regenerating the icon set
// (`npm run gen:icons`) — the icon is its input, so re-run this whenever the
// icon changes.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const BRAND_TEAL = '#0f766e'
const WIDTH = 1200
const HEIGHT = 630
const ICON_SIZE = 360

const iconPath = fileURLToPath(new URL('../public/pwa-512x512.png', import.meta.url))
const outPath = fileURLToPath(new URL('../public/og-image.png', import.meta.url))

const icon = await sharp(await readFile(iconPath))
  .resize(ICON_SIZE, ICON_SIZE)
  .toBuffer()

const image = await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 3,
    background: BRAND_TEAL,
  },
})
  .composite([{ input: icon, left: (WIDTH - ICON_SIZE) / 2, top: (HEIGHT - ICON_SIZE) / 2 }])
  .png()
  .toBuffer()

await writeFile(outPath, image)
console.log(`Wrote ${outPath}`)
