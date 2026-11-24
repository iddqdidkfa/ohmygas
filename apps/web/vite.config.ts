import react from '@vitejs/plugin-react';
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const DATA_DIR = resolve(__dirname, '../../data');

/** Serves ../../data at /data in dev and copies it into dist/data on build. */
function staticData(): Plugin {
  return {
    name: 'ohmygas-static-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const file = resolve(DATA_DIR, '.' + (req.url ?? '').split('?')[0]);
        if (!file.startsWith(DATA_DIR) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('content-type', 'application/json');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (existsSync(DATA_DIR)) cpSync(DATA_DIR, resolve(__dirname, 'dist/data'), { recursive: true });
    },
  };
}

// base './' lets the build work from any path (GitHub Pages project site or custom domain)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    staticData(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'OhMyGas — ціни на пальне',
        short_name: 'OhMyGas',
        description: 'Ціни на пальне та мапа АЗС України з вашими знижками',
        lang: 'uk',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#14171a',
        theme_color: '#0b6bcb',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // app shell is precached; price/station data is always tried on the network first
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/data\/[^/]+\.json$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'ohmygas-data', networkTimeoutSeconds: 5 },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
