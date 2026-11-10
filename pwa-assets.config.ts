import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The icon is full-bleed with its own background, so the maskable and Apple variants are
// used as-is instead of being padded onto white. Full-colour PNGs: the default 256-colour palette
// bands the cheeks' soft blush.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    png: { compressionLevel: 9, palette: false },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
})
