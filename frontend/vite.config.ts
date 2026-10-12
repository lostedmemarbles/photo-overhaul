import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // heicDecoder.worker.ts dynamically imports heic2any (code-splitting) -
  // Vite's default worker output format (IIFE) doesn't support that. This
  // matches how the worker is already constructed at runtime (heicWorkerPool.ts
  // creates it with { type: 'module' }).
  worker: {
    format: 'es',
  },
})
