/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Elsewhere",
        short_name: "Elsewhere",
        description:
          "Cost-of-living parity — what salary keeps your life the same?",
        theme_color: "#1a1d1a",
        background_color: "#f7f5ef",
        display: "standalone",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,json,svg,woff2}"] },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
