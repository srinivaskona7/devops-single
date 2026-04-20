import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // In Docker dev: VITE_BACKEND_URL=http://backend:8100 (set in docker-compose.dev.yml)
  // Native dev:    falls back to 127.0.0.1:8100
  const backendUrl = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8100';
  const wsUrl = backendUrl.replace(/^http/, 'ws');

  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api':    { target: backendUrl, changeOrigin: true },
        '/auth':   { target: backendUrl, changeOrigin: true },
        '/run':    { target: backendUrl, changeOrigin: true },
        '/health': { target: backendUrl, changeOrigin: true },
        '/ws': {
          target: wsUrl,
          ws: true,
          changeOrigin: true,
          rewriteWsOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      // Tree-shake console.log in production
      minify: 'terser',
      terserOptions: {
        compress: { drop_console: mode === 'production', drop_debugger: true },
      },
      rollupOptions: {
        output: {
          // Optimal chunk splitting for caching
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'ui-vendor': ['lucide-react', 'clsx', 'tailwind-merge'],
            'editor': ['@monaco-editor/react'],
            'terminal': ['@xterm/xterm', '@xterm/addon-fit'],
            'charts': ['recharts'],
          },
        },
      },
      // Target modern browsers only
      target: 'es2020',
      // Warn on large chunks
      chunkSizeWarningLimit: 500,
    },
  };
});
