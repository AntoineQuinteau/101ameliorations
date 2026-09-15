import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates public/pwa-*.png, public/maskable-icon-512x512.png,
// public/apple-touch-icon-180x180.png and public/favicon.ico from a single
// source SVG (output lands next to the input, hence public/icon-source.svg
// rather than a separate assets/ directory). Run `npm run gen:icons` after
// editing public/icon-source.svg — never hand-edit the generated PNGs.
export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: minimal2023Preset,
  images: ['public/icon-source.svg'],
})
