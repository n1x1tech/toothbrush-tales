import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'icons/*.png'],
            manifest: {
                name: 'Toothbrush Tales',
                short_name: 'Brush Tales',
                description: 'Fun AI-powered stories to make toothbrushing exciting for kids!',
                theme_color: '#FF6B6B',
                background_color: '#F7FFF7',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/',
                start_url: '/',
                categories: ['kids', 'education', 'health'],
                icons: [
                    {
                        src: '/icons/icon-72x72.png',
                        sizes: '72x72',
                        type: 'image/png',
                    },
                    {
                        src: '/icons/icon-96x96.png',
                        sizes: '96x96',
                        type: 'image/png',
                    },
                    {
                        src: '/icons/icon-128x128.png',
                        sizes: '128x128',
                        type: 'image/png',
                    },
                    {
                        src: '/icons/icon-144x144.png',
                        sizes: '144x144',
                        type: 'image/png',
                    },
                    {
                        src: '/icons/icon-152x152.png',
                        sizes: '152x152',
                        type: 'image/png',
                    },
                    {
                        src: '/icons/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/icons/icon-384x384.png',
                        sizes: '384x384',
                        type: 'image/png',
                    },
                    {
                        src: '/icons/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                // Cache stories in localStorage, but cache API responses and assets
                runtimeCaching: [
                    {
                        // Cache Amplify/AWS API calls
                        urlPattern: /^https:\/\/.*\.amazonaws\.com\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'aws-api-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                            },
                            networkTimeoutSeconds: 10,
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        // Cache Amplify AppSync GraphQL
                        urlPattern: /^https:\/\/.*\.appsync-api\..*\.amazonaws\.com\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'appsync-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24, // 1 day
                            },
                            networkTimeoutSeconds: 10,
                        },
                    },
                    {
                        // Cache Google Fonts
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-stylesheets',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                            },
                        },
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                            },
                        },
                    },
                ],
            },
            // Dev options for testing
            devOptions: {
                enabled: false, // Set to true to test PWA in dev mode
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
