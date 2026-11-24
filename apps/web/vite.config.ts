import react from '@vitejs/plugin-react';
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

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
export default defineConfig({ base: './', plugins: [react(), staticData()], server: { port: 5173 } });
