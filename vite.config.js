import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Vite reemplaza a Create React App (react-scripts, ya sin mantenimiento).
// - Los archivos .js de src/ tienen JSX: se le indica a esbuild que los lea como JSX.
// - Se conservan las variables REACT_APP_* que ya están configuradas en Vercel.
// - La salida sigue en build/ (igual que antes) para no tocar la configuración de Vercel.
export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/ }), tailwindcss()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: { loader: { '.js': 'jsx' } },
  },
  build: {
    outDir: 'build',
    chunkSizeWarningLimit: 4000,
  },
  server: { port: 3000 },
  test: {
    globals: true,
    environment: 'node',
  },
});
