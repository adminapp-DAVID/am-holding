import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Versión de cada despliegue: la app la compara con /version.json y avisa "Hay una versión nueva · Actualizar".
const VERSION = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const versionJson = () => ({
  name: 'version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION }) });
  },
});

// Vite reemplaza a Create React App (react-scripts, ya sin mantenimiento).
// - Los archivos .js de src/ tienen JSX: se le indica a esbuild que los lea como JSX.
// - Se conservan las variables REACT_APP_* que ya están configuradas en Vercel.
// - La salida sigue en build/ (igual que antes) para no tocar la configuración de Vercel.
export default defineConfig({
  plugins: [react({ include: /\.(js|jsx)$/ }), tailwindcss(), versionJson()],
  define: { __VERSION__: JSON.stringify(VERSION) },
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
    // Segunda página: catálogo de componentes del sistema de diseño (sin login ni datos).
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        sistemaDiseno: path.resolve(import.meta.dirname, 'sistema-diseno.html'),
      },
    },
  },
  server: { port: 3000 },
  test: {
    globals: true,
    environment: 'node',
  },
});
