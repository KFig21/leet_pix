import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  // .env lives at the monorepo root, not in client/.
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Root styles/ folder, shared with the design system.
      "@styles": fileURLToPath(new URL("../styles", import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Make tokens/mixins importable as `@use "variables" as *;`
        loadPaths: [fileURLToPath(new URL("../styles", import.meta.url))],
      },
    },
  },
  server: {
    port: 5173,
  },
});
