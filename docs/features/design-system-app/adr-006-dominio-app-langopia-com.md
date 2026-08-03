# ADR-006 — `app.langopia.com` sirve la SPA y proxifica la API (same-origin)

- Estado: aceptado
- Fecha: 2026-08-03

## Contexto

La app debe vivir en `app.langopia.com` y "la API es llamada por ella también". El patrón ya implantado en el repo —producción (`apps/web/vercel.json` reescribe `/api/*` → `https://api.langopia.com/api/*`), dev (proxy de Vite), previews (`pr-N.web.langopia.com`) y sites (middleware)— es exactamente ese: el navegador solo habla con su propio origen y la plataforma hace de proxy inverso. Así, la cookie de sesión de Better Auth viaja first-party (`SameSite=Lax`, host-only) y CORS casi no entra en juego.

## Decisión

1. La SPA sigue llamando a rutas relativas `/api/*`; el rewrite de Vercel las envía a `api.langopia.com`. **No** se llama a la API directamente cross-origin desde el navegador.
2. Configuración en Vercel (sin cambios de código):
   - Proyecto `langopia-app`: dominio `app.langopia.com`.
   - Proyecto `langopia-api`: dominio `api.langopia.com` (ya referenciado por el rewrite).
   - Env de producción de la API: `BETTER_AUTH_URL=https://api.langopia.com/api/v1/auth`, `BETTER_AUTH_TRUSTED_ORIGINS=https://app.langopia.com` (lista por comas si hay más orígenes).
3. `langopia.com` **no** se añade a `TENANT_BASE_DOMAINS`: se reserva para la futura landing pública del producto. `app` y `api` ya son subdominios reservados; el tenant sigue llegando por la cabecera `x-school-slug`.
4. Verificación: login + sesión persistente + llamada autenticada en preview con alias `pr-N.app.langopia.com` antes de tocar producción, y de nuevo tras asignar el dominio.

## Consecuencias

- Sin cambios en cookies ni CORS del código; una sola fuente de orígenes (`BETTER_AUTH_TRUSTED_ORIGINS`).
- El `Origin` del navegador será `https://app.langopia.com` incluso vía rewrite: sin la env var, Better Auth responde 403 `INVALID_ORIGIN` (riesgo RD-2).
- Las sesiones del dominio anterior no migran (cookie host-only): los usuarios re-inician sesión una vez.

## Alternativas consideradas

- Llamadas directas a `api.langopia.com` (sin proxy): exige `SameSite=None; Secure`, cookie con `Domain=.langopia.com` (`advanced.crossSubDomainCookies`), CORS con credenciales y base URL absoluta en el cliente. Más superficie por cero beneficio; rechazado.
- Servir la SPA desde el propio proyecto de la API: mezcla despliegues y rompe el modelo de tres proyectos Vercel; rechazado.
- Token en `localStorage` en lugar de cookie: mayor exposición XSS; rechazado.
