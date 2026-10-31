import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@react-three/fiber',
      'three',
      'lucide-react',
      'zustand',
      'zod',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Keep Vite's secure host check: localhost and raw IP addresses are always
    // allowed; add specific tunnel hostnames to server.allowedHosts if needed
    // instead of disabling validation for every host.
  },
  build: {
    // First-party chunks should stay under ~500 KB raw. The vendor-three and
    // vendor-r3f framework chunks legitimately exceed this; app chunks should not.
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/three/')) {
            return 'vendor-three';
          }
          if (id.includes('node_modules/@react-three/')) {
            return 'vendor-r3f';
          }
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-lucide';
          }
          if (id.includes('node_modules/zod/')) {
            return 'vendor-zod';
          }
        },
      },
    },
  },
});