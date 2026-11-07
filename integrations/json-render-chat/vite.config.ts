import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Lede's source, its json-render item included, lives in ../../registry, outside this app, under the path a shadcn
// install gives it: `@/components/lede`. Its imports resolve from here through `dedupe`, so the repo root needs no
// install of its own.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@/components/lede': here('../../registry/lede') },
    dedupe: ['react', 'react-dom', '@base-ui/react', '@react-aria/interactions', '@json-render/core', '@json-render/react', 'zod'],
  },
  server: { port: 4880, strictPort: true, fs: { allow: ['../..'] }, proxy: { '/api': 'http://localhost:4882' } },
  preview: { port: 4881, strictPort: true },
});
