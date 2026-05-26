import { defineConfig } from 'vite';

export default defineConfig({
  base: '/WebRapfi/',
  root: '.',
  publicDir: 'public',
  server: {
    port: 3000,
    headers: {
      // SharedArrayBuffer (マルチスレッドWASM) に必要
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'index.html',
    },
  },
});
