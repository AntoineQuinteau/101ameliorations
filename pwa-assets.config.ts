import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates public/pwa-*.png, public/maskable-icon-512x512.png,
// public/apple-touch-icon-180x180.png and public/favicon.ico from a single
// source SVG (output lands next to the input, hence public/icon-source.svg
// rather than a separate assets/ directory). Run `npm run gen:icons` after
// editing public/icon-source.svg — never hand-edit the generated PNGs.

// Brand teal, the tile color of public/icon-source.svg (also vite.config.ts's
// theme_color).
const BRAND_TEAL = '#0f766e'

// Launchers crop the maskable icon to their own shape (circle, squircle…) and
// iOS rounds the apple-touch-icon itself, so both must be opaque, full-bleed
// squares. The generator's default for them shrinks the source by 30% onto a
// white canvas, which shows as a white ring around a small teal tile. The
// source mark already sits inside the maskable safe zone, so no padding is
// needed: paint the canvas brand teal and let it fill the source's rounded
// corners.
const fullBleed = {
  padding: 0,
  resizeOptions: { fit: 'contain', background: BRAND_TEAL },
} as const

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, ...fullBleed },
    apple: { ...minimal2023Preset.apple, ...fullBleed },
  },
  images: ['public/icon-source.svg'],
})
