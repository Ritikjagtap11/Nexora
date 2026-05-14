import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'NEXORA AI Document System',
        short_name: 'NEXORA',
        description: 'Intelligent Document Retrieval System Using LLM',
        theme_color: '#F95F9E',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/folder.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/folder.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})