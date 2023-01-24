// vite.config.js

import { defineConfig, loadEnv } from 'vite'

export default defineConfig({
    // plugins: [vue()],
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