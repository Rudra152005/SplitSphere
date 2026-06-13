import { defineConfig } from "@tanstack/react-start/config";

export default defineConfig({
  server: {
    preset: process.env.VERCEL ? "vercel" : "node-server",
  },
});
