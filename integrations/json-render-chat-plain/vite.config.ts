import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 4870, strictPort: true, proxy: { '/api': 'http://localhost:4872' } },
  preview: { port: 4871, strictPort: true },
});
