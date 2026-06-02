import { defineConfig } from 'vite'

// Base path is overridden during the gh-pages build via the CLI flag
// (`--base=/coi/`). For local dev it stays at root.
export default defineConfig({
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
})
