import { resolve } from 'path';
import { defineConfig } from 'vite';
import viteImagemin from 'vite-plugin-imagemin';

export default defineConfig({
  base: '/',
  plugins: [
    viteImagemin({
      gifsicle: {
        optimizationLevel: 7
      },
      optipng: {
        optimizationLevel: 7
      },
      mozjpeg: {
        quality: 80
      },
      pngquant: {
        quality: [0.7, 0.8]
      },
      svgo: {
        plugins: [
          {
            name: 'removeViewBox'
          },
          {
            name: 'removeEmptyAttrs',
            active: false
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild',
    // 不移除console.log，以便在生产环境中调试
    esbuild: {
      drop: ['debugger']
    },
    rollupOptions: {
      // 多页入口：主站 + 管理后台
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html')
      },
      output: {
        assetFileNames: 'assets/[name].[hash:8].[ext]',
        chunkFileNames: 'assets/[name].[hash:8].js',
        entryFileNames: 'assets/[name].[hash:8].js'
      }
    },
    cssCodeSplit: true,
    sourcemap: false
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
});