import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Freebuff platform requirement: HMR must stay disabled (server.hmr: false).
export default defineConfig(async ({mode}) => {
 const env=loadEnv(mode,'.','');
 // @ts-ignore Node-only helper used solely by the local QA environment.
 const qa=env.VITE_SOCIAL_API==='/qa-social/v1'?(await import('./scripts/social-preview.mjs')).socialPreview():null;
 return {
  plugins: [react(), ...(qa?[qa]:[])],
  server: {
    host: true,
    hmr: false,
    allowedHosts: [".e2b.app", "terminal.local"],
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
};});
