import { resolve } from 'path';
import { defineConfig } from 'vite';
import viteImagemin from 'vite-plugin-imagemin';
import { biliProxyMiddleware } from './vite-bili-proxy.mjs';

export default defineConfig({
  base: '/',
  // 双入口 MPA（前台 index.html + 管理后台 admin/index.html）：
  // 关闭 SPA history fallback，否则 dev 下 /admin 会被重写到前台首页
  appType: 'mpa',
  plugins: [
    // B 站代理中间件（开发环境模拟 EdgeOne Pages 的 /api/bili-proxy）
    biliProxyMiddleware(),
    // dev 下把 /admin 重定向到 /admin/（MPA 模式无目录重定向，与生产环境静态托管行为对齐）
    {
      name: 'admin-dir-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/admin' || req.url === '/admin?') {
            res.writeHead(301, { Location: '/admin/' });
            res.end();
            return;
          }
          next();
        });
      }
    },
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