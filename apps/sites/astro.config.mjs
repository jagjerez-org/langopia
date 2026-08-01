import { defineConfig } from "astro/config";

import vercel from "@astrojs/vercel";

export default defineConfig({
  // El hostname hace falta en tiempo de petición para saber de qué escuela
  // es la web. Con un build estático habría que desplegar cada vez que una
  // escuela nueva publica, que es justo lo que no queremos.
  output: "server",
  adapter: vercel(),
  vite: {
    ssr: {
      // Evita que `cookie` (CJS) se importe con named exports en el runtime
      // serverless de Vercel; Astro lo empaqueta como dependencia interna.
      noExternal: ["cookie"],
    },
    server: {
      // La app sirve TODOS los dominios de las escuelas: en desarrollo la
      // lista blanca de hosts de Vite bloquearía cualquier `Host` que no sea
      // localhost y no se podría probar la resolución multidominio en local.
      allowedHosts: true,
      // El formulario de contacto llama a `/api/v1/...` en el MISMO origen
      // (en producción el middleware hace de proxy hacia la API, ver
      // `src/middleware.ts`). En desarrollo no hay middleware: Vite hace de
      // proxy hacia la API local.
      proxy: {
        "/api": {
          target: process.env.API_URL ?? "http://localhost:3100",
          changeOrigin: true,
        },
      },
    },
  },
});
