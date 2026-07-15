import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves this repository from a sub-path. Local development,
  // desktop packages, and direct hosting continue to use the site root.
  base: process.env.GITHUB_ACTIONS ? '/sales-os-field-ops/' : '/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'maps', test: /node_modules[\\/](leaflet|react-leaflet|@react-leaflet)/ },
          ],
        },
      },
    },
  },
})
