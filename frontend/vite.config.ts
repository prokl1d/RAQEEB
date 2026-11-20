import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Forward /api to the FastAPI backend so the browser never needs API keys
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
