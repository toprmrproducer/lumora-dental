import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/admin/",
  root: path.resolve("src/admin"),
  publicDir: false,
  resolve: {
    alias: { "@": path.resolve("src") },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: path.resolve("dist/admin"),
    emptyOutDir: true,
  },
});
