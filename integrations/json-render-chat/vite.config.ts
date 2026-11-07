import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Lede's source and the json-render entry's catalog live outside this app, under the paths a copy into an app's src/
// gives them: `@/components/lede` from a shadcn install and `@/json-render` from copying the catalog. Their imports
// resolve from here through `dedupe`, so neither the repo root nor ../json-render needs an install of its own.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@/components/lede': here('../../registry/lede'), '@/json-render': here('../json-render/src') },
    dedupe: ['react', 'react-dom', '@base-ui/react', '@react-aria/interactions', '@json-render/core', '@json-render/react', 'zod'],
  },
  server: { port: 4880, strictPort: true, fs: { allow: ['../..'] }, proxy: { '/api': 'http://localhost:4882' } },
  preview: { port: 4881, strictPort: true },
});
