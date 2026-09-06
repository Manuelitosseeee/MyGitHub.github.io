import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Freebuff platform requirement: HMR must stay disabled (server.hmr: false).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    hmr: false,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
