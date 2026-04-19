import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const bridgeUrl = env.VITE_BRIDGE_URL || 'http://localhost:3000';
  const infuseWorkUrl = env.VITE_INFUSE_WORK_URL || 'http://localhost:3990';

  console.log(`[Vite] AdminIT → Bridge: ${bridgeUrl}`);
  console.log(`[Vite] AdminIT → Infuse Work: ${infuseWorkUrl}`);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared/components': path.resolve(__dirname, '../softbits-shared/components'),
        '@shared/hooks': path.resolve(__dirname, '../softbits-shared/hooks'),
      },
      // Ensure shared components resolve deps from admin's node_modules
      dedupe: ['react', 'react-dom', 'clsx', 'lucide-react', 'react-dom/client'],
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
        '/health': {
          target: bridgeUrl,
          changeOrigin: true,
        },
        '/work': {
          target: infuseWorkUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/work/, ''),
        },
      },
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
