import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@pytsa/tsgraph2": path.resolve(root, "../tsgraph2/src/index.ts"),
    },
  },
  server: {
    port: 5176,
  },
});
