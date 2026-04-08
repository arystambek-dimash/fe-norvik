/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/r2-proxy": {
        target: "https://pub-0f21558eef0d42a39f2ba250b314573c.r2.dev",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/r2-proxy/, ""),
      },
    },
  },
  test: {
    globals: true,
  },
});