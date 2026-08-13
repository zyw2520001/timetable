import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'

// Vite 配置
// 关键：主进程和 preload 都输出为 CJS 格式（format: 'cjs'）
// 因为 package.json 没有 "type": "module"，所以 .js 文件默认就是 CJS
export default defineConfig({
  plugins: [
    vue(),
    electron([
      {
        // 主进程
        entry: 'electron/main/index.ts',
        onstart: ({ startup }) => startup(),
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron', 'pdfjs-dist', '@napi-rs/canvas'],
              output: { format: 'cjs', entryFileNames: 'index.js' }
            }
          }
        }
      },
      {
        // Preload（CJS 格式，输出为 .js）
        entry: 'electron/preload/index.ts',
        onstart: () => {},
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
              output: { format: 'cjs', entryFileNames: 'index.js' }
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500
  },
  server: { port: 5173 }
})
