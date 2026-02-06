import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // Core React and framework
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // State management
          'state': ['zustand', 'axios'],
          // UI library and grid
          'ui-vendor': ['react-grid-layout'],
          // Charts (if used)
          'lodash': ['lodash'],
        },
      },
    },
    // Increase chunk size warning limit since we're manually chunking
    chunkSizeWarningLimit: 600,
  },
})
