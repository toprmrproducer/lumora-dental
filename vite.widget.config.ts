import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": '"production"' },
  resolve: {
    alias: { "@": path.resolve("src") },
  },
  build: {
    lib: {
      entry: path.resolve("src/widget/main.tsx"),
      name: "MolaVoiceWidget",
      formats: ["iife"],
      fileName: () => "mola-widget.js",
    },
    outDir: path.resolve("assets/js"),
    emptyOutDir: false,
    cssCodeSplit: false,
  },
});
