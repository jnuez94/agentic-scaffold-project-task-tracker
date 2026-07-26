/// <reference types="node" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// The Python server serves this build under a strict CSP:
//   default-src 'none'; script-src 'self'; style-src 'self'
// So nothing may be inlined into the HTML and nothing may reference a remote
// origin. `assetsInlineLimit: 0` keeps small assets as separate files rather
// than data: URIs in CSS, and modulePreload polyfill is disabled because it
// injects an inline script.
export default defineConfig({
  plugins: [react()],
  root: __dirname,
  build: {
    outDir: resolve(__dirname, "../coordination_ui/static"),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // `npm run dev` proxies the API to the Python server so the console can be
    // developed with hot reload against a real coordination database.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
