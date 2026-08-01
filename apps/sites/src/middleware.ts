import { defineMiddleware } from "astro:middleware";

import { resolveSiteForRequest } from "./site-resolution";

/**
 * Resuelve de qué escuela es esta petición a partir del hostname.
 *
 * Es el equivalente al interceptor de tenant de la API, en el borde público.
 * Un hostname que no corresponde a ninguna escuela verificada devuelve 404:
 * jamás la web de otra.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const site = await resolveSiteForRequest({
    apiUrl: import.meta.env.API_URL,
    request: context.request,
  });

  if (site === null) {
    return new Response("Sitio no encontrado", { status: 404 });
  }

  context.locals.site = site;
  return next();
});
