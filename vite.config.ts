import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Freebuff platform requirement: HMR must stay disabled (server.hmr: false).
// Relative base for the production build so the app works from any subpath
// (e.g. GitHub Pages at https://<user>.github.io/<repo>/).
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "./" : "/",
  server: {
    host: true,
    hmr: false,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
}));
