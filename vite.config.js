import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' = caminhos relativos: funciona na Vercel e na página publicada no Claude
export default defineConfig({
  plugins: [react()],
  base: './',
});
