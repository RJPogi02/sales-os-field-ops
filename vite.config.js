import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))

function sitesHostingMetadata() {
  return {
    name: 'sites-hosting-metadata',
    apply: 'build',
    closeBundle() {
      const source = resolve(projectRoot, '.openai', 'hosting.json')
      const target = resolve(projectRoot, 'dist', '.openai', 'hosting.json')
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(source, target)
    },
  }
}

export default defineConfig(async () => {
  // Keep Cloudflare's local build state inside the project. GitHub Pages keeps
  // its existing static build, while OpenAI Sites receives Worker output.
  process.env.WRANGLER_WRITE_LOGS ??= 'false'
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs'
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry'

  const plugins = [react(), sitesHostingMetadata()]
  if (!process.env.GITHUB_ACTIONS) {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    plugins.push(cloudflare())
  }

  return {
    // GitHub Pages serves this repository from a sub-path. Local development,
    // desktop packages, and direct hosting continue to use the site root.
    base: process.env.GITHUB_ACTIONS ? '/sales-os-field-ops/' : '/',
    plugins,
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
  }
})
