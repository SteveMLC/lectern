import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  server: {
    // `pnpm dev:web` gives HMR; API calls proxy to `wrangler dev` on 8787.
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
