import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  build: {
    // Raise the warning threshold — we know Firebase is large
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting:
         * - firebase bundle (auth + firestore) → lazy-loaded, not in initial JS
         * - react-dom → separate stable chunk, long cache TTL
         * - vendor (dayjs, crypto-js, dexie) → separate stable chunk
         *
         * This means the critical first-paint JS is just your app code.
         */
        manualChunks(id) {
          if (id.includes("firebase")) return "firebase";
          if (id.includes("react-dom"))  return "react-dom";
          if (
            id.includes("dayjs") ||
            id.includes("crypto-js") ||
            id.includes("dexie")
          ) return "vendor";
        },
      },
    },

    // Minify with esbuild (default, fastest)
    minify: "esbuild",

    // Generate source maps for debugging without exposing source in prod
    sourcemap: false,

    // Target modern browsers — smaller, faster output
    target: "es2020",

    // CSS code splitting — only load styles needed for rendered route
    cssCodeSplit: true,
  },

  // Dev server
  server: {
    port: 5173,
    open: false,
  },
});