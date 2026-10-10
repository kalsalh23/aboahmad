import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('exceljs')) return 'vendor-export'
            if (id.includes('lucide-react')) return 'vendor-icons'
            if (id.includes('react-router') || id.includes('/react/') || id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react'
            if (id.includes('@supabase')) return 'vendor-supabase'
          }
          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})