import { defineConfig } from 'vite'

export default defineConfig({
  base: '/jornada-brf/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  }
})
