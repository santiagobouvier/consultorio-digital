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
      // "prompt" en lugar de "autoUpdate" para que Workbox NO tome control
      // automáticamente con clientsClaim + skipWaiting mientras el usuario
      // está navegando/scrolleando — eso causaba "recargas fantasma" en medio
      // del scroll en la landing y otras páginas.
      registerType: "prompt",
      devOptions: {
        enabled: false,
      },
      manifest: {
        id: "/",
        scope: "/",
        name: "Tu Consultorio Digital",
        short_name: "Consultorio Digital",
        description: "Sistema de gestión de consultorios - Agenda, pacientes y pagos",
        theme_color: "#111111",
        background_color: "#111111",
        display: "standalone",
        orientation: "portrait",
        start_url: "/auth",
        icons: [
          {
            src: "/app-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "/app-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        navigateFallbackDenylist: [/^\/~oauth/],
        cleanupOutdatedCaches: true,
        // Importante: NO usar skipWaiting/clientsClaim juntos con autoUpdate.
        // El nuevo SW espera (waiting) hasta que se cierren todas las pestañas
        // o hasta que el usuario refresque manualmente. Esto evita reloads
        // inesperados en medio de la sesión.
        skipWaiting: false,
        clientsClaim: false,
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
