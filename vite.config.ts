import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'TerraMind Ops OS',
          short_name: 'TerraMind',
          description: 'Enterprise Field Intelligence for Property Management',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // NOTE: previous rules for /api/crm, /api/knowledge and /api/workflows were
          // removed — every route under those paths is POST-only (server.ts registers
          // them exclusively via app.post, and all frontend call sites send POST), and
          // workbox runtimeCaching only matches GET requests by default, so those rules
          // could never cache anything. App data actually flows through the Supabase
          // REST endpoint (PostgREST GETs issued by src/lib/repos/*), cached below.
          runtimeCaching: [
            {
              // Tenant data reads (customers, jobs, invoices, ...) via Supabase
              // PostgREST. NetworkFirst with a short timeout so flaky field
              // connections fall back to the last-known-good rows fast.
              urlPattern: ({ url }) =>
                url.host.endsWith('.supabase.co') && url.pathname.startsWith('/rest/'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-rest-cache',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24, // 24h — field-day freshness
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // The only /api endpoints the frontend actually GETs: weather widget,
              // Maps key config, AI credit usage, team roster. Small, cheap to keep
              // warm for offline/field mode.
              urlPattern: ({ url }) =>
                url.pathname.startsWith('/api/weather') ||
                url.pathname.startsWith('/api/config/maps') ||
                url.pathname.startsWith('/api/usage/credits') ||
                url.pathname.startsWith('/api/team'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-get-cache',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 32,
                  maxAgeSeconds: 60 * 60 * 24,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'lucide-react', 'firebase/app', 'firebase/firestore', 'firebase/auth'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
