# Plan de modelo de datos — Design System Langopia + rename + dominio

> Entradas: `brief.md`, `domain-analysis.md`, `solution.md` (todos aprobados).
> **Conclusión anticipada: no hay cambios de esquema ni migraciones de base de datos.** Esta feature es puramente de frontend, tooling y configuración de despliegue.

## Entidades y relaciones de datos

### Base de datos PostgreSQL (`packages/db`)

Ninguna tabla, columna, relación o política RLS se ve afectada por:

- Creación de `packages/ui` (componentes de presentación, sin estado persistente).
- Rename `apps/web` → `apps/app` (cambio de nombre de workspace).
- Configuración del dominio `app.langopia.com` (la resolución de tenant sigue usando `x-school-slug`; `langopia.com` no se añade a `TENANT_BASE_DOMAINS`).

### Stores externas

| Store | Uso previsto | Impacto |
|---|---|---|
| Vercel KV / Edge Config | Ninguno | Sin cambios. |
| AWS S3 (media library) | Los componentes de "Media library" son presentacionales en esta fase; no gestionan subida ni almacenamiento | Sin cambios. |
| Stripe | Checkout page presentacional; sin integración de pago en esta fase | Sin cambios. |
| `localStorage` (navegador) | Preferencia de tema (`langopia:theme`) y slug de escuela (`langopia:school-slug`) ya existentes | Se añade/renombra **preferencia de tema** si aún no existe; no hay estructura de datos nueva. |
| `document.documentElement.dataset.theme` | Estado visual del tema claro/oscuro | Solo runtime; no persistencia. |

### Cachés

- Sin cambios en Redis/Valkey ni en caché de TanStack Query. Los componentes del DS son stateless; los datos vienen de los consumidores.

## Cambios de esquema

Ninguno.

## Migraciones (forward)

Ninguna.

## Plan de rollback

Ninguno (no hay migraciones).

## Índices y restricciones

Ninguno.

## PII / datos sensibles / cumplimiento

- **RGPD**: la molécula `CookiesRgpd` del design system es **presentacional** en esta fase; muestra el banner de cookies, pero no activa tracking ni gestión de consentimiento real. Cuando se conecte al sistema de consentimiento real, se tratará como feature aparte.
- **No se introducen nuevos campos PII** ni se altera la retención/eliminación de datos.
- Las cookies de sesión (`better-auth.session_token`) mantienen su configuración actual (host-only, `SameSite=Lax`, `Secure`). El cambio de dominio del panel las vuelve inválidas solo para el dominio antiguo, lo cual es el comportamiento esperado.

## Riesgos de migración o backfill

Ninguno.

## Preguntas abiertas

1. ¿Se quiere persistir algún estado de UI más allá del tema (p. ej. preferencia de densidad de lista, columnas del calendario)? → Fuera del alcance de esta feature; si surge, se tratará en el slice correspondiente.
2. ¿La futura landing en `langopia.com` requerirá un `site` o `public_sites` distinto? → No forma parte de este plan; se evaluará cuando se diseñe la landing.

## Notas operativas (no son datos, pero impactan el despliegue)

- Variables de entorno en Vercel a configurar manualmente (ver `adr-006-dominio-app-langopia-com.md`):
  - Proyecto `langopia-app`: dominio `app.langopia.com`.
  - Proyecto `langopia-api`: `BETTER_AUTH_URL=https://api.langopia.com/api/v1/auth`, `BETTER_AUTH_TRUSTED_ORIGINS=https://app.langopia.com`.
- No hay cambios en `packages/db/src/schema/`, `packages/db/src/apply-policies.ts`, ni en `apps/api/src/contexts/*/domain/**`.
