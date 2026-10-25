import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The icon is full-bleed with its own background, so the maskable and Apple variants are
// used as-is instead of being padded onto white.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/icon.svg'],
})
