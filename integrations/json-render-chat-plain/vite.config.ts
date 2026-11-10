import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `/api` goes to the chat server, on `PORT` when it's set, as the server reads it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 4870, strictPort: true, proxy: { '/api': `http://localhost:${process.env.PORT ?? 4872}` } },
  preview: { port: 4871, strictPort: true },
});
