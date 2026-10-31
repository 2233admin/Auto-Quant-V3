import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The built bundle is committed to autoquant/studio_app/ and served by `aq studio serve` under
// /studio-app/. Studio's CSP allows only same-origin scripts, styles and fonts, so nothing is inlined.
export default defineConfig({
  base: '/studio-app/',
  plugins: [react()],
  build: {
    outDir: '../autoquant/studio_app',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  server: { proxy: { '/api': 'http://127.0.0.1:8765' } },
})
