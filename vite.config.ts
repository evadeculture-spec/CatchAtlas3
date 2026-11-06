import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Modo "artifact": build num único HTML com router em hash (sem service worker).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // Modo "e2e": substitui o catálogo de fotografias por um catálogo de TESTE (nunca publicado).
  resolve: mode === 'e2e' ? { alias: [{ find: /^.*\/data\/photos\/catalog\.json$/, replacement: fileURLToPath(new URL('./e2e/fixtures/photo-catalog.json', import.meta.url)) }, { find: /^.*\/data\/photos\/unsplash\.json$/, replacement: fileURLToPath(new URL('./e2e/fixtures/unsplash-empty.json', import.meta.url)) }] } : undefined,
  base: mode === 'artifact' ? './' : '/',
  build: {
    outDir: mode === 'artifact' ? 'dist-artifact' : mode === 'e2e' ? 'dist-e2e' : 'dist',
    assetsInlineLimit: mode === 'artifact' ? 100_000_000 : 4096,
    cssCodeSplit: mode !== 'artifact',
    rollupOptions: mode === 'artifact' ? { output: { inlineDynamicImports: true } } : undefined,
  },
}))
