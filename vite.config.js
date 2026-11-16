// vite.config.js

import { defineConfig, loadEnv } from 'vite'

export default defineConfig({
    base: './',
    server: {
        proxy: {
            '/wp-json': {
                target: 'http://al-khatib.local',
                changeOrigin: true,
            },
            '/wp-content': {
                target: 'http://al-khatib.local',
                changeOrigin: true,
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                entryFileNames: `assets/[name].js`,
                // chunkFileNames: `assets/[name].js`,
                assetFileNames: `assets/[name].[ext]`
            }
        }
    }
})