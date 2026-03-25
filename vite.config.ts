/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import path from 'path';

const version = readFileSync(path.resolve(__dirname, 'VERSION'), 'utf-8').trim();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const bridgeUrl = env.VITE_BRIDGE_URL || 'http://localhost:3000';

  console.log(`[Vite] AdminIT → Bridge: ${bridgeUrl}`);

  return {
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared/components': path.resolve(__dirname, '../softbits-shared/components'),
        '@shared/hooks': path.resolve(__dirname, '../softbits-shared/hooks'),
      },
      // Ensure shared components resolve deps from admin's node_modules
      dedupe: ['react', 'react-dom', 'clsx', 'lucide-react', 'react-dom/client', 'date-fns'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'clsx', 'lucide-react'],
    },
    server: {
      port: 3080,
      host: true,
      proxy: {
        '/api': {
          target: bridgeUrl,
          changeOrigin: true,
        },
        '/admin': {
          target: bridgeUrl,
          changeOrigin: true,
        },
        '/work': {
          target: env.VITE_WORK_URL || 'http://localhost:3990',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/work/, ''),
        },
        '/health': {
          target: bridgeUrl,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      globals: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'vendor': ['axios', 'date-fns', 'lucide-react'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
  };
});
