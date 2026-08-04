/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // El proxy evita CORS en desarrollo y hace que las cookies de sesión
    // viajen como si fueran del mismo origen, que es como irán en producción.
    // `API_PROXY_TARGET` (Tarea 8): sin variable, el destino sigue siendo
    // `:3000` de siempre. Con ella, se puede levantar esta SPA contra una API
    // en otro puerto — necesario para verificar en vivo sin tumbar la
    // instancia de otro agente que ya esté usando el 3000 a la vez.
    proxy: { "/api": { target: process.env.API_PROXY_TARGET ?? "http://localhost:3000", changeOrigin: true } },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: false,
    // `e2e/` (Tarea 13) es de Playwright, no de Vitest: sin excluirlo,
    // Vitest lo recoge también por el patrón `*.spec.ts` de siempre e intenta
    // transformarlo con jsdom, sin los `webServer` ni el resto de la
    // configuración que ese fichero necesita de verdad (`playwright.config.ts`).
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
