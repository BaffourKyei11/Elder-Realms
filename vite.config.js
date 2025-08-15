import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['pouchdb']
  },
  build: {
    rollupOptions: {
      // If you prefer to externalize instead of bundling, uncomment below:
      // external: ['pouchdb']
    }
  }
})
