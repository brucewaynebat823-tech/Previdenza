import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Pubblicazione su GitHub Pages: https://<utente>.github.io/Previdenza/
export default defineConfig({
  base: '/Previdenza/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json}'] },
      manifest: {
        name: 'Previdenza – confronto costi e preventivo',
        short_name: 'Previdenza',
        lang: 'it',
        start_url: '/Previdenza/',
        scope: '/Previdenza/',
        display: 'standalone',
        background_color: '#f4f6fb',
        theme_color: '#0b3d91',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
});
