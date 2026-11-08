/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const BRIDGE = fileURLToPath(new URL('./bridge/worldledger-mcp.mjs', import.meta.url))

/** Serve the MCP bridge script next to the app, so Settings can offer it as a download. */
function bridgeFile(): Plugin {
  return {
    name: 'worldledger-bridge-file',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.split('?')[0].endsWith('/worldledger-mcp.mjs')) return next()
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.end(readFileSync(BRIDGE))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'worldledger-mcp.mjs', source: readFileSync(BRIDGE, 'utf8') })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /<repo-name>/; the deploy workflow sets VITE_BASE.
  // Routing uses the URL hash, so no server-side rewrites are needed.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), bridgeFile()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'bridge/**/*.test.ts'],
  },
})
