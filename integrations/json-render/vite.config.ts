import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Lede's source lives in ../../registry, outside this app, and its imports resolve from here through `dedupe`, so the
// repo root needs no install of its own.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@/components/lede': fileURLToPath(new URL('../../registry/lede', import.meta.url)) },
    dedupe: ['react', 'react-dom', '@base-ui/react', '@react-aria/interactions'],
  },
  server: { port: 4890, strictPort: true, fs: { allow: ['../..'] } },
  preview: { port: 4891, strictPort: true },
});
