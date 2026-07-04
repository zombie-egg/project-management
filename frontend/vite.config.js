import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  server: {
    port: 5173,
    proxy: {
      // 开发环境将 /api 代理到后端
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
