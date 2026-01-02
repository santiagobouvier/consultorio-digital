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
      includeAssets: ["favicon.png", "assets/logo-footer.png"],
      manifest: {
        name: "Tu Consultorio Digital",
        short_name: "Tu Consultorio",
        description: "Sistema de gestión de consultorios - Agenda, pacientes y pagos",
        theme_color: "#00a5a0",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/auth",
        icons: [
          {
            src: "app-icon-512.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "app-icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
