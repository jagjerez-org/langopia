import { defineMiddleware } from "astro:middleware";

import { resolveSiteForRequest } from "./site-resolution";

/**
 * Resuelve de qué escuela es esta petición a partir del hostname.
 *
 * Es el equivalente al interceptor de tenant de la API, en el borde público.
 * Un hostname que no corresponde a ninguna escuela verificada devuelve 404:
 * jamás la web de otra.
 *
 * Antes de eso, las rutas `/api/*` se desvían a la API: el formulario de
 * contacto llama a `/api/v1/...` en el MISMO origen (así las cookies y el
 * CORS no son un problema), y en producción cada dominio de escuela apunta
 * a este despliegue — sin este proxy, la llamada moriría aquí con un 404.
 * Es un pase directo de la petición (método, cabeceras y cuerpo), sin
 * tocarla: la API sigue viendo el `Host` original en la cabecera
 * `x-forwarded-host` que añade la plataforma, y la resolución de tenant de
 * la API no depende del `Host` de estas llamadas.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const apiUrl: string | undefined = import.meta.env.API_URL;
  if (!apiUrl) {
    return new Response("API_URL no configurada", { status: 503 });
  }
  const { pathname, search } = context.url;

  if (pathname.startsWith("/api/")) {
    return fetch(`${apiUrl}${pathname}${search}`, context.request);
  }

  const site = await resolveSiteForRequest({
    apiUrl,
    request: context.request,
  });

  if (site === null) {
    return new Response("Sitio no encontrado", { status: 404 });
  }

  context.locals.site = site;
  return next();
});
