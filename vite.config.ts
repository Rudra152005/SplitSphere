import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { 
        preset: process.env.VERCEL ? "vercel" : "node-server",
        entry: "server" 
      },
    }),
    react(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 8080,
  },
});
