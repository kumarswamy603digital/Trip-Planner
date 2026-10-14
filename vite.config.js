import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { createNarrateHandler } from './server/narrateHandler.mjs'

/**
 * Dev-and-preview twin of the `api/narrate.js` serverless function.
 * `npm run dev` and `npm run preview` therefore behave exactly like the deployed app:
 * POST /api/narrate is answered by the same handler code, reading the key from .env.
 */
function narrateDevPlugin() {
  const handle = createNarrateHandler()

  const use = (middlewares) => {
    middlewares.use('/api/narrate', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ fallback: true, reason: 'method-not-post' }))
        return
      }
      handle(req, res)
    })
  }

  return {
    name: 'namma-yatri-narrate-dev-api',
    configureServer(server) {
      use(server.middlewares)
    },
    configurePreviewServer(server) {
      use(server.middlewares)
    }
  }
}

export default defineConfig({
  plugins: [react(), narrateDevPlugin()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') }
  },
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          map: ['leaflet', 'react-leaflet']
        }
      }
    }
  }
})
