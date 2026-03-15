import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // チャンクサイズ警告の閾値を引き上げ（chart.js + jspdf が大きいため）
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // 大きなライブラリを別チャンクに分割して初期ロードを高速化
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-chart': ['chart.js'],
        },
      },
    },
  },
});
