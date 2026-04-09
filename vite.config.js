import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      buffer: 'buffer/',
      stream: 'stream-browserify',
      events: 'events/',
    },
  },
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
    open: true,
    host: true,
    headers: {
      // Required for SharedArrayBuffer in workers
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    chunkSizeWarningLimit: 800,
    // Enable SRI hashes on script/link tags
    subresourceIntegrity: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'crypto-core': ['@noble/hashes', '@noble/secp256k1', '@noble/ed25519', 'tweetnacl'],
          'crypto-bip': ['bip32', 'bip39', 'bs58'],
          'crypto-ethers': ['ethers'],
          'ui-vendor': ['lucide-react', 'qrcode.react'],
        },
      },
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
})
