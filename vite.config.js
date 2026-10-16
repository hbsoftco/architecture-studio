import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  build: { target: 'es2022' },
  server: { host: '127.0.0.1' },
});
