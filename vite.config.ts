import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      manifest: {
        id: "/",
        scope: "/",
        name: "Tu Consultorio Digital",
        short_name: "Consultorio Digital",
        description: "Sistema de gestión de consultorios - Agenda, pacientes y pagos",
        theme_color: "#00a5a0",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/auth",
        icons: [
          {
            src: "/app-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/app-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Evita que se bundleen múltiples copias de React (causa "Invalid hook call")
    dedupe: ["react", "react-dom"],
  },
}));
