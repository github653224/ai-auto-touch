import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3002,  // 更改端口为3002
    proxy: {
      '/api': {
        target: 'http://localhost:8001',  // 后端主服务端口
        changeOrigin: true,
      },
    },
  },
})