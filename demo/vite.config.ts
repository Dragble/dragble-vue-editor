import path from "path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 4012,
    open: true,
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      vue: path.resolve(__dirname, "node_modules/vue"),
    },
  },
});
