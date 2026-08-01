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
});
