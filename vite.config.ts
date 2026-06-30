import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// On GitHub Pages the site is served from /<repo>/, so assets need that base
// in production builds. Dev keeps serving from root.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/rehub/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
}));
