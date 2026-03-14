import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:3000'

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    define: {
      // Make environment variables available in the client
      __VITE_API_URL__: JSON.stringify(apiUrl),
      __VITE_USER__: JSON.stringify(env.VITE_USER || 'admin'),
      __VITE_PASSWORD__: JSON.stringify(env.VITE_PASSWORD || 'Admin@12345'),
      __VITE_CREATOR_USER__: JSON.stringify(env.VITE_CREATOR_USER || 'creator'),
      __VITE_CREATOR_PASSWORD__: JSON.stringify(env.VITE_CREATOR_PASSWORD || 'Creator@12345'),
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          // Express server handles /api/route routes unchanged
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: process.env.NODE_ENV !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor:   ['react', 'react-dom', 'react-router-dom'],
            charts:   ['recharts'],
            pdf:      ['jspdf', 'jspdf-autotable'],
            xlsx:     ['xlsx'],
          },
        },
      },
    },
  }
})
