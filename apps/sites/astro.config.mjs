import { defineConfig } from "astro/config";

import node from "@astrojs/node";

export default defineConfig({
  // El hostname hace falta en tiempo de petición para saber de qué escuela
  // es la web. Con un build estático habría que desplegar cada vez que una
  // escuela nueva publica, que es justo lo que no queremos.
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    server: {
      // La app sirve TODOS los dominios de las escuelas: en desarrollo la
      // lista blanca de hosts de Vite bloquearía cualquier `Host` que no sea
      // localhost y no se podría probar la resolución multidominio en local.
      allowedHosts: true,
      // El formulario de contacto llama a `/api/v1/...` en el MISMO origen
      // (en producción el borde enruta `/api` a la API). En desarrollo no
      // hay borde, así que Vite hace de proxy hacia la API local.
      proxy: {
        "/api": {
          target: process.env.API_URL ?? "http://localhost:3100",
          changeOrigin: true,
        },
      },
    },
  },
});
