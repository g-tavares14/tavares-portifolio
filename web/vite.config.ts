import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, /api/* e as imagens dos textos (/articles/*) vão para o back-end em Go (porta 8080).
// Em produção, o Go serve o build (web/dist) e a API no mesmo domínio.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/articles': 'http://localhost:8080',
    },
  },
});
