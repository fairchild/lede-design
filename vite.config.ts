import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { llms } from './scripts/llms/vite-plugin.mjs';

export default defineConfig({
  base: '/',
  // llms() adds each docs page's Markdown, the registry items' reference pages, llms.txt and llms-full.txt.
  plugins: [react(), tailwindcss(), llms()],
  resolve: {
    alias: {
      '@lede': fileURLToPath(new URL('./registry/lede', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
